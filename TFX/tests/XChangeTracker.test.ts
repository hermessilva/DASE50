import { describe, it, expect } from "vitest";
import { XTrackAction, XChangeTracker, XTrackableElement } from "../src/Core/XChangeTracker.js";

describe("XTrackAction", () =>
{
    it("should have None value as 0", () =>
    {
        expect(XTrackAction.None).toBe(0);
    });

    it("should have Insert value as 1", () =>
    {
        expect(XTrackAction.Insert).toBe(1);
    });

    it("should have Delete value as 2", () =>
    {
        expect(XTrackAction.Delete).toBe(2);
    });

    it("should have Change value as 3", () =>
    {
        expect(XTrackAction.Change).toBe(3);
    });
});

describe("XChangeTracker", () =>
{
    function createMockElement(): XTrackableElement
    {
        return { ID: "00000000-0000-0000-0000-000000000001" } as XTrackableElement;
    }

    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const tracker = new XChangeTracker();
            expect(tracker).toBeInstanceOf(XChangeTracker);
            expect(tracker.GroupTitle).toBe("");
            expect(tracker.GroupAction).toBe(XTrackAction.None);
        });
    });

    describe("StartGroup", () =>
    {
        it("should set group title and action for Insert", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("Add new item", XTrackAction.Insert);
            expect(tracker.GroupTitle).toBe("Add new item");
            expect(tracker.GroupAction).toBe(XTrackAction.Insert);
        });

        it("should set group title and action for Delete", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("Remove item", XTrackAction.Delete);
            expect(tracker.GroupTitle).toBe("Remove item");
            expect(tracker.GroupAction).toBe(XTrackAction.Delete);
        });

        it("should set group title and action for Change", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("Modify item", XTrackAction.Change);
            expect(tracker.GroupTitle).toBe("Modify item");
            expect(tracker.GroupAction).toBe(XTrackAction.Change);
        });

        it("should set group title and action for None", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("No action", XTrackAction.None);
            expect(tracker.GroupTitle).toBe("No action");
            expect(tracker.GroupAction).toBe(XTrackAction.None);
        });

        it("should overwrite previous group", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("First group", XTrackAction.Insert);
            tracker.StartGroup("Second group", XTrackAction.Delete);
            expect(tracker.GroupTitle).toBe("Second group");
            expect(tracker.GroupAction).toBe(XTrackAction.Delete);
        });

        it("should handle empty title", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("", XTrackAction.Insert);
            expect(tracker.GroupTitle).toBe("");
            expect(tracker.GroupAction).toBe(XTrackAction.Insert);
        });

        it("should handle long title", () =>
        {
            const tracker = new XChangeTracker();
            const longTitle = "A".repeat(1000);
            tracker.StartGroup(longTitle, XTrackAction.Change);
            expect(tracker.GroupTitle).toBe(longTitle);
        });
    });

    describe("TrackInsert", () =>
    {
        it("should accept trackable element", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackInsert(element)).not.toThrow();
        });

        it("should accept multiple elements", () =>
        {
            const tracker = new XChangeTracker();
            expect(() =>
            {
                tracker.TrackInsert(createMockElement());
                tracker.TrackInsert(createMockElement());
                tracker.TrackInsert(createMockElement());
            }).not.toThrow();
        });
    });

    describe("TrackDelete", () =>
    {
        it("should accept trackable element", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackDelete(element)).not.toThrow();
        });

        it("should accept multiple elements", () =>
        {
            const tracker = new XChangeTracker();
            expect(() =>
            {
                tracker.TrackDelete(createMockElement());
                tracker.TrackDelete(createMockElement());
            }).not.toThrow();
        });
    });

    describe("TrackChange", () =>
    {
        it("should accept all parameters", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackChange(
                element,
                {} as any,
                {} as any,
                "oldValue",
                "newValue"
            )).not.toThrow();
        });

        it("should accept null old value", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackChange(
                element,
                {} as any,
                {} as any,
                null,
                "newValue"
            )).not.toThrow();
        });

        it("should accept null new value", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackChange(
                element,
                {} as any,
                {} as any,
                "oldValue",
                null
            )).not.toThrow();
        });

        it("should accept both null values", () =>
        {
            const tracker = new XChangeTracker();
            const element = createMockElement();
            expect(() => tracker.TrackChange(
                element,
                {} as any,
                {} as any,
                null,
                null
            )).not.toThrow();
        });
    });

    describe("GroupTitle getter", () =>
    {
        it("should return empty string initially", () =>
        {
            const tracker = new XChangeTracker();
            expect(tracker.GroupTitle).toBe("");
        });

        it("should return set value", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("Test Title", XTrackAction.Insert);
            expect(tracker.GroupTitle).toBe("Test Title");
        });
    });

    describe("GroupAction getter", () =>
    {
        it("should return None initially", () =>
        {
            const tracker = new XChangeTracker();
            expect(tracker.GroupAction).toBe(XTrackAction.None);
        });

        it("should return set value", () =>
        {
            const tracker = new XChangeTracker();
            tracker.StartGroup("Test", XTrackAction.Change);
            expect(tracker.GroupAction).toBe(XTrackAction.Change);
        });
    });
});
