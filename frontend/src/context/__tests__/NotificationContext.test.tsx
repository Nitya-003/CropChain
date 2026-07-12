/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { NotificationProvider, useNotifications } from "../NotificationContext";
import { notificationService } from "../../services/notificationService";
import { onNewNotification } from "../../services/socketService";
import { useAuth } from "../AuthContext";
import toast from "react-hot-toast";

jest.mock("../AuthContext", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../../services/notificationService", () => ({
    notificationService: {
        getNotifications: jest.fn(),
        getUnreadCount: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
    },
}));

jest.mock("../../services/socketService", () => ({
    onNewNotification: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
    __esModule: true,
    default: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

const mockedUseAuth = useAuth as jest.Mock;
const mockedGetNotifications = notificationService.getNotifications as jest.Mock;
const mockedGetUnreadCount = notificationService.getUnreadCount as jest.Mock;
const mockedMarkAsRead = notificationService.markAsRead as jest.Mock;
const mockedMarkAllAsRead = notificationService.markAllAsRead as jest.Mock;
const mockedOnNewNotification = onNewNotification as jest.Mock;

const sampleNotifications = [
    { _id: "n1", title: "First alert", read: false },
    { _id: "n2", title: "Second alert", read: false },
];

// Simple consumer used to exercise the context from tests.
function NotificationConsumer() {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } =
        useNotifications();

    return (
        <div>
            <div data-testid="loading">{String(loading)}</div>
            <div data-testid="unread-count">{unreadCount}</div>
            <div data-testid="notification-count">{notifications.length}</div>
            <button onClick={() => fetchNotifications()}>Refetch</button>
            <button onClick={() => markAsRead("n1")}>Mark n1 read</button>
            <button onClick={() => markAllAsRead()}>Mark all read</button>
        </div>
    );
}

const renderWithProvider = () =>
    render(
        <NotificationProvider>
            <NotificationConsumer />
        </NotificationProvider>
    );

describe("NotificationContext", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetNotifications.mockResolvedValue([...sampleNotifications]);
        mockedGetUnreadCount.mockResolvedValue(2);
        mockedMarkAsRead.mockResolvedValue(undefined);
        mockedMarkAllAsRead.mockResolvedValue(undefined);
        mockedOnNewNotification.mockReturnValue(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("never gets stuck loading for a logged-out user", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: false, user: null });

        renderWithProvider();

        // Regression check for the bug: loading must resolve to false, not
        // stay stuck at its initial `true` value forever.
        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });
        expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
        expect(mockedGetNotifications).not.toHaveBeenCalled();
    });

    it("clears notifications and stops loading when a user logs out", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        const { rerender } = render(
            <NotificationProvider>
                <NotificationConsumer />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        });
        expect(screen.getByTestId("loading")).toHaveTextContent("false");

        // User logs out.
        mockedUseAuth.mockReturnValue({ isAuthenticated: false, user: null });
        rerender(
            <NotificationProvider>
                <NotificationConsumer />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });
        expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });

    it("fetches notifications and turns off loading for an authenticated user", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        renderWithProvider();

        expect(screen.getByTestId("loading")).toHaveTextContent("true");

        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });
        expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        expect(screen.getByTestId("unread-count")).toHaveTextContent("2");
        expect(mockedGetNotifications).toHaveBeenCalledTimes(1);
        expect(mockedGetUnreadCount).toHaveBeenCalledTimes(1);
    });

    it("does not fetch notifications when logged out, even if fetchNotifications is called directly", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: false, user: null });

        renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });

        act(() => {
            screen.getByRole("button", { name: "Refetch" }).click();
        });

        expect(mockedGetNotifications).not.toHaveBeenCalled();
    });

    it("marks a single notification as read and decrements the unread count", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        });

        await act(async () => {
            screen.getByRole("button", { name: "Mark n1 read" }).click();
        });

        expect(mockedMarkAsRead).toHaveBeenCalledWith("n1");
        await waitFor(() => {
            expect(screen.getByTestId("unread-count")).toHaveTextContent("1");
        });
    });

    it("shows an error toast when marking a notification as read fails", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });
        mockedMarkAsRead.mockRejectedValue(new Error("network error"));

        renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        });

        await act(async () => {
            screen.getByRole("button", { name: "Mark n1 read" }).click();
        });

        expect(toast.error).toHaveBeenCalledWith("Failed to mark notification as read");
    });

    it("marks all notifications as read and zeroes the unread count", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        });

        await act(async () => {
            screen.getByRole("button", { name: "Mark all read" }).click();
        });

        expect(mockedMarkAllAsRead).toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
        });
    });

    it("subscribes to real-time notifications and cleans up on unmount when authenticated", async () => {
        const cleanup = jest.fn();
        mockedOnNewNotification.mockReturnValue(cleanup);
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        const { unmount } = renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });

        expect(mockedOnNewNotification).toHaveBeenCalledTimes(1);
        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("does not subscribe to real-time notifications when logged out", async () => {
        mockedUseAuth.mockReturnValue({ isAuthenticated: false, user: null });

        renderWithProvider();
        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("false");
        });

        expect(mockedOnNewNotification).not.toHaveBeenCalled();
    });

    it("polls for notifications every 60 seconds while authenticated", async () => {
        jest.useFakeTimers({ legacyFakeTimers: false });
        mockedUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: "u1" } });

        renderWithProvider();

        await waitFor(() => {
            expect(mockedGetNotifications).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            jest.advanceTimersByTime(60000);
        });
        await waitFor(() => {
            expect(mockedGetNotifications).toHaveBeenCalledTimes(2);
        });
    });
});