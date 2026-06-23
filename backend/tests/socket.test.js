process.env.JWT_SECRET = 'test_secret_key_for_jwt';

const jwt = require('jsonwebtoken');

jest.mock('socket.io', () => {
  const useCallback = jest.fn();
  const onCallback = jest.fn();
  const toFn = jest.fn(() => ({
    emit: jest.fn(),
  }));
  const emitFn = jest.fn();

  const mockIo = {
    use: useCallback,
    on: onCallback,
    to: toFn,
    emit: emitFn,
  };

  const Server = jest.fn(() => mockIo);
  Server.mockIo = mockIo;
  Server.useCallback = useCallback;
  Server.onCallback = onCallback;
  Server.toFn = toFn;
  Server.emitFn = emitFn;

  return { Server };
});

describe('Socket.IO Service', () => {
  let socketService;
  let mockSocket;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    socketService = require('../services/socketService');
    mockSocket = {
      handshake: {
        auth: {},
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('Auth Middleware', () => {
    test('should reject connection without token', () => {
      const { Server } = require('socket.io');
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      expect(useCallback).toHaveBeenCalled();

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication required'));
    });

    test('should accept connection with valid token in auth', () => {
      const { Server } = require('socket.io');
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const validToken = jwt.sign(
        { id: 'user-1', email: 'test@test.com', role: 'farmer' },
        process.env.JWT_SECRET
      );

      mockSocket.handshake.auth.token = validToken;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe('user-1');
      expect(mockSocket.user.email).toBe('test@test.com');
      expect(mockSocket.user.role).toBe('farmer');
    });

    test('should accept connection with valid token in Authorization header', () => {
      const { Server } = require('socket.io');
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const validToken = jwt.sign(
        { id: 'user-2', email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET
      );

      mockSocket.handshake.headers.authorization = `Bearer ${validToken}`;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe('user-2');
    });

    test('should reject connection with invalid token', () => {
      const { Server } = require('socket.io');
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      mockSocket.handshake.auth.token = 'invalid-token';

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Invalid token'));
    });

    test('should reject connection with expired token', () => {
      const { Server } = require('socket.io');
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const expiredToken = jwt.sign(
        { id: 'user-3', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );

      mockSocket.handshake.auth.token = expiredToken;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Invalid token'));
    });
  });

  describe('Event Emission', () => {
    let mockIo;

    beforeEach(() => {
      const { Server } = require('socket.io');
      socketService.initializeSocketIO({});
      mockIo = Server.mockIo;
    });

    test('emitToBatchRoom should emit to the correct room', () => {
      const eventData = { batchId: 'BATCH001', cropType: 'Rice' };

      socketService.emitToBatchRoom('BATCH001', 'batch:created', eventData);

      expect(mockIo.to).toHaveBeenCalledWith('batch:BATCH001');
    });
  });
});
