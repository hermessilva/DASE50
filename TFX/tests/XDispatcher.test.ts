import { describe, it, expect, vi } from "vitest";
import { XDispatcher } from "../src/Core/XDispatcher.js";

describe("XDispatcher", () =>
{
    describe("Execute", () =>
    {
        it("should execute action synchronously", () =>
        {
            const action = vi.fn();

            XDispatcher.Execute(action);

            expect(action).toHaveBeenCalledTimes(1);
        });

        it("should execute action immediately", () =>
        {
            const order: number[] = [];

            order.push(1);
            XDispatcher.Execute(() => order.push(2));
            order.push(3);

            expect(order).toEqual([1, 2, 3]);
        });

        it("should execute multiple actions in order", () =>
        {
            const results: string[] = [];

            XDispatcher.Execute(() => results.push("first"));
            XDispatcher.Execute(() => results.push("second"));
            XDispatcher.Execute(() => results.push("third"));

            expect(results).toEqual(["first", "second", "third"]);
        });

        it("should allow action to modify external state", () =>
        {
            let value = 0;

            XDispatcher.Execute(() => { value = 42; });

            expect(value).toBe(42);
        });

        it("should propagate exceptions", () =>
        {
            const errorAction = () =>
            {
                throw new Error("Test error");
            };

            expect(() => XDispatcher.Execute(errorAction)).toThrow("Test error");
        });
    });

    describe("ExecuteAsync", () =>
    {
        it("should execute action asynchronously", async () =>
        {
            const action = vi.fn();

            XDispatcher.ExecuteAsync(action);

            expect(action).not.toHaveBeenCalled();

            await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

            expect(action).toHaveBeenCalledTimes(1);
        });

        it("should execute after current synchronous code", async () =>
        {
            const order: number[] = [];

            order.push(1);
            XDispatcher.ExecuteAsync(() => order.push(3));
            order.push(2);

            expect(order).toEqual([1, 2]);

            await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

            expect(order).toEqual([1, 2, 3]);
        });

        it("should execute multiple async actions in queue order", async () =>
        {
            const results: string[] = [];

            XDispatcher.ExecuteAsync(() => results.push("first"));
            XDispatcher.ExecuteAsync(() => results.push("second"));
            XDispatcher.ExecuteAsync(() => results.push("third"));

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(results).toEqual(["first", "second", "third"]);
        });

        it("should allow action to modify external state asynchronously", async () =>
        {
            let value = 0;

            XDispatcher.ExecuteAsync(() => { value = 42; });

            expect(value).toBe(0);

            await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

            expect(value).toBe(42);
        });

        it("should not block synchronous execution", () =>
        {
            const start = Date.now();
            let asyncExecuted = false;

            XDispatcher.ExecuteAsync(() =>
            {
                asyncExecuted = true;
            });

            const elapsed = Date.now() - start;

            expect(elapsed).toBeLessThan(10);
            expect(asyncExecuted).toBe(false);
        });
    });

    describe("Execute vs ExecuteAsync", () =>
    {
        it("should show difference in execution timing", async () =>
        {
            const order: string[] = [];

            order.push("start");
            XDispatcher.ExecuteAsync(() => order.push("async"));
            XDispatcher.Execute(() => order.push("sync"));
            order.push("end");

            expect(order).toEqual(["start", "sync", "end"]);

            await new Promise(resolve => queueMicrotask(() => resolve(undefined)));

            expect(order).toEqual(["start", "sync", "end", "async"]);
        });
    });
});
