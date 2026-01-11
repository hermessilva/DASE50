import { describe, it, expect, vi } from "vitest";
import { XEvent } from "../src/Core/XEvent.js";

describe("XEvent", () =>
{
    describe("Add", () =>
    {
        it("should add a handler", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);

            expect(event.HasHandlers).toBe(true);
        });

        it("should not add duplicate handlers", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Add(handler);

            event.Invoke();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("should add multiple different handlers", () =>
        {
            const event = new XEvent<() => void>();
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            event.Add(handler1);
            event.Add(handler2);

            event.Invoke();
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe("Remove", () =>
    {
        it("should remove a handler", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Remove(handler);

            expect(event.HasHandlers).toBe(false);
        });

        it("should not throw when removing non-existent handler", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            expect(() => event.Remove(handler)).not.toThrow();
        });

        it("should only remove specified handler", () =>
        {
            const event = new XEvent<() => void>();
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            event.Add(handler1);
            event.Add(handler2);
            event.Remove(handler1);

            event.Invoke();
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe("Invoke", () =>
    {
        it("should call all handlers", () =>
        {
            const event = new XEvent<() => void>();
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const handler3 = vi.fn();

            event.Add(handler1);
            event.Add(handler2);
            event.Add(handler3);

            event.Invoke();

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
            expect(handler3).toHaveBeenCalledTimes(1);
        });

        it("should pass arguments to handlers", () =>
        {
            const event = new XEvent<(pA: number, pB: string) => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Invoke(42, "test");

            expect(handler).toHaveBeenCalledWith(42, "test");
        });

        it("should not throw when no handlers", () =>
        {
            const event = new XEvent<() => void>();

            expect(() => event.Invoke()).not.toThrow();
        });

        it("should call handlers multiple times when invoked multiple times", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Invoke();
            event.Invoke();
            event.Invoke();

            expect(handler).toHaveBeenCalledTimes(3);
        });
    });

    describe("Raise", () =>
    {
        it("should be an alias for Invoke", () =>
        {
            const event = new XEvent<(pValue: number) => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Raise(123);

            expect(handler).toHaveBeenCalledWith(123);
        });

        it("should call all handlers like Invoke", () =>
        {
            const event = new XEvent<() => void>();
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            event.Add(handler1);
            event.Add(handler2);
            event.Raise();

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });
    });

    describe("HasHandlers", () =>
    {
        it("should return false when no handlers", () =>
        {
            const event = new XEvent<() => void>();

            expect(event.HasHandlers).toBe(false);
        });

        it("should return true when has handlers", () =>
        {
            const event = new XEvent<() => void>();
            event.Add(() => {});

            expect(event.HasHandlers).toBe(true);
        });

        it("should return false after all handlers removed", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);
            expect(event.HasHandlers).toBe(true);

            event.Remove(handler);
            expect(event.HasHandlers).toBe(false);
        });
    });

    describe("Clear", () =>
    {
        it("should remove all handlers", () =>
        {
            const event = new XEvent<() => void>();
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            event.Add(handler1);
            event.Add(handler2);
            event.Clear();

            expect(event.HasHandlers).toBe(false);
        });

        it("should not call handlers after clear", () =>
        {
            const event = new XEvent<() => void>();
            const handler = vi.fn();

            event.Add(handler);
            event.Clear();
            event.Invoke();

            expect(handler).not.toHaveBeenCalled();
        });

        it("should not throw when already empty", () =>
        {
            const event = new XEvent<() => void>();

            expect(() => event.Clear()).not.toThrow();
        });
    });

    describe("typed events", () =>
    {
        it("should work with complex handler signatures", () =>
        {
            interface EventData
            {
                id: number;
                name: string;
            }

            const event = new XEvent<(pSender: object, pData: EventData) => void>();
            const handler = vi.fn();
            const sender = { type: "test" };
            const data: EventData = { id: 1, name: "Test" };

            event.Add(handler);
            event.Invoke(sender, data);

            expect(handler).toHaveBeenCalledWith(sender, data);
        });

        it("should work with return values (though ignored)", () =>
        {
            const event = new XEvent<(pValue: number) => number>();
            const handler = vi.fn().mockReturnValue(42);

            event.Add(handler);
            event.Invoke(10);

            expect(handler).toHaveBeenCalledWith(10);
        });
    });
});
