import { useEffect, useState, useCallback } from "react";
import {
  joinAuctionRoom,
  leaveAuctionRoom,
  placeBid,
  onAuctionUpdated,
  onAuctionEnded,
  onBidError,
  isConnected,
  getSocket,
} from "../services/socketService";
import toast from "react-hot-toast";

export const useAuctionSocket = (auctionId?: string) => {
  const [socketConnected, setSocketConnected] = useState(isConnected());
  const [liveAuction, setLiveAuction] = useState<any | null>(null);
  const [liveBids, setLiveBids] = useState<any[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!auctionId) return;

    // Join the auction room
    joinAuctionRoom(auctionId);

    // Register real-time updates
    const cleanupUpdate = onAuctionUpdated((updatedAuction) => {
      if (updatedAuction._id === auctionId) {
        setLiveAuction(updatedAuction);

        // Append incoming bid to the beginning of the feed
        const incomingBid = {
          _id: Date.now().toString(),
          auctionId,
          userId: updatedAuction.highestBidder,
          userName: updatedAuction.highestBidderName || "Buyer",
          cropId: updatedAuction.batchId,
          bidAmount: updatedAuction.currentHighestBid,
          timestamp: new Date().toISOString(),
        };

        setLiveBids((prev) => [incomingBid, ...prev]);
        toast.success(
          `New highest bid: ${updatedAuction.currentHighestBid} credits!`,
        );
      }
    });

    // Register auction ended event
    const cleanupEnded = onAuctionEnded((endedAuction) => {
      if (endedAuction._id === auctionId) {
        setLiveAuction(endedAuction);
        toast.error("This auction has ended!");
      }
    });

    // Register bid error event
    const cleanupError = onBidError((error) => {
      toast.error(error.message);
    });

    return () => {
      leaveAuctionRoom(auctionId);
      cleanupUpdate();
      cleanupEnded();
      cleanupError();
    };
  }, [auctionId]);

  const placeNewBid = useCallback(
    (amount: number) => {
      if (!auctionId) return;
      placeBid(auctionId, amount);
    },
    [auctionId],
  );

  return {
    liveAuction,
    setLiveAuction,
    liveBids,
    setLiveBids,
    placeNewBid,
    isConnected: socketConnected,
  };
};
