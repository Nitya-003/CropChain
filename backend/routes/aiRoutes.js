const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const batchService = require("../services/batchService");
const notificationService = require("../services/notificationService");
const apiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");
const validateRequest = require("../middleware/validator");
const { chatSchema } = require("../validations/chatSchema");
const { protect } = require("../middleware/auth");
const { batchLimiter } = require("../middleware/rateLimiters");

// Create batch service interface for AI service
const batchServiceForAI = {
  async getBatch(batchId) {
    const result = await batchService.getBatch(batchId);
    return result.success ? result.batch : null;
  },
  async getBatchByIdOrPartial(id) {
    return await batchService.getBatchByIdOrPartial(id);
  },
  async searchBatches(filters) {
    return await batchService.searchBatches(filters);
  },
  async getLatestBatch(cropType) {
    return await batchService.getLatestBatch(cropType);
  },
  async getDashboardStats() {
    return await batchService.getDashboardStats();
  },
};

router.post(
  "/chat",
  batchLimiter,
  protect,
  validateRequest(chatSchema),
  async (req, res) => {
    try {
      const { message } = req.body;
      logger.info("AI chat request", {
        ip: req.ip,
        messagePreview: message.substring(0, 50),
      });

      const acceptsEventStream =
        req.headers.accept?.includes("text/event-stream");

      if (acceptsEventStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        const sendEvent = (event, data) => {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const aiResponse = await aiService.chatStream(
          message,
          batchServiceForAI,
          (token) => {
            sendEvent("token", { token });
          },
        );

        sendEvent("done", {
          response: aiResponse.message,
          timestamp: new Date().toISOString(),
          ...(aiResponse.functionCalled && {
            functionCalled: aiResponse.functionCalled,
            functionResult: aiResponse.functionResult,
          }),
        });

        res.end();
        logger.info("AI chat streamed response generated", { ip: req.ip });
        return;
      }

      const aiResponse = await aiService.chat(message, batchServiceForAI);
      logger.info("AI chat response generated", { ip: req.ip });

      const response = apiResponse.successResponse(
        {
          response: aiResponse.message,
          timestamp: new Date().toISOString(),
          ...(aiResponse.functionCalled && {
            functionCalled: aiResponse.functionCalled,
            functionResult: aiResponse.functionResult,
          }),
        },
        "Chat response generated successfully",
      );
      res.json(response);
    } catch (error) {
      notificationService.notifyError("AI chat", error);
      logger.error("AI chat error", {
        error: error.message,
        stack: error.stack,
      });

      if (res.headersSent) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            error:
              "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.",
          })}\n\n`,
        );
        res.end();
        return;
      }

      let fallbackPayload;
      try {
        const fallback = aiService?.getFallbackResponse?.(
          req?.body?.message || "",
        );
        fallbackPayload = fallback || null;
      } catch (_) {
        fallbackPayload = null;
      }

      const message =
        fallbackPayload?.message ||
        "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.";

      const response = apiResponse.successResponse(
        { response: message, timestamp: new Date().toISOString() },
        "Chat response generated successfully (fallback)",
      );

      res.status(503).json(response);
    }
  },
);

router.post(
  "/batch-query",
  batchLimiter,
  protect,
  validateRequest(chatSchema),
  async (req, res) => {
    try {
      const { message, context } = req.body;
      logger.info("AI batch query request", {
        ip: req.ip,
        messagePreview: message.substring(0, 50),
        context,
      });

      const acceptsEventStream =
        req.headers.accept?.includes("text/event-stream");

      if (acceptsEventStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        const sendEvent = (event, data) => {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const aiResponse = await aiService.chatWithBatchContext(
          message,
          context,
          batchServiceForAI,
          (token) => {
            sendEvent("token", { token });
          },
          (status) => {
            sendEvent("status", { status });
          },
        );

        sendEvent("done", {
          response: aiResponse.message,
          timestamp: new Date().toISOString(),
        });

        res.end();
        logger.info("AI batch query streamed response generated", {
          ip: req.ip,
        });
        return;
      }

      const aiResponse = await aiService.chatWithBatchContext(
        message,
        context,
        batchServiceForAI,
        null,
        null,
      );
      logger.info("AI batch query response generated", { ip: req.ip });

      const response = apiResponse.successResponse(
        {
          response: aiResponse.message,
          timestamp: new Date().toISOString(),
        },
        "Batch query response generated successfully",
      );
      res.json(response);
    } catch (error) {
      notificationService.notifyError("AI batch query", error);
      logger.error("AI batch query error", {
        error: error.message,
        stack: error.stack,
      });

      if (res.headersSent) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({
            error:
              "I'm sorry, I'm having trouble processing your query right now. Please try asking about specific supply chain batches or transit times.",
          })}\n\n`,
        );
        res.end();
        return;
      }

      let fallbackMessage =
        "I'm sorry, I'm having trouble processing your query right now. Please try asking about specific supply chain batches or transit times.";
      try {
        const fallback = aiService?.getFallbackResponse?.(
          req?.body?.message || "",
        );
        if (fallback && fallback.message) {
          fallbackMessage = fallback.message;
        }
      } catch (_) {}

      const response = apiResponse.successResponse(
        { response: fallbackMessage, timestamp: new Date().toISOString() },
        "Batch query response generated successfully (fallback)",
      );

      res.status(503).json(response);
    }
  },
);

module.exports = router;
