import { describe, expect, it } from "vitest";
import { Route, formatRoute, parseRoute } from "../src/lib/route";

describe("画面とURLの対応", () => {
  const cases: [string, Route][] = [
    ["#/", { name: "list" }],
    ["#/menu/menu_1_abc", { name: "edit", menuId: "menu_1_abc", mode: "sheet" }],
    ["#/menu/menu_1_abc/order", { name: "edit", menuId: "menu_1_abc", mode: "order" }],
    ["#/menu/menu_1_abc/image", { name: "edit", menuId: "menu_1_abc", mode: "image" }],
    ["#/summary?ids=menu_1,menu_2", { name: "summary", menuIds: ["menu_1", "menu_2"] }],
    ["#/summary", { name: "summary", menuIds: [] }],
    ["#/profile", { name: "profile" }],
  ];

  it.each(cases)("%s を読み書きできる（往復で同じになる）", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
    expect(formatRoute(route)).toBe(hash);
  });

  it("URLが空（初回・ホーム画面から起動）なら献立一覧", () => {
    expect(parseRoute("")).toEqual({ name: "list" });
    expect(parseRoute("#")).toEqual({ name: "list" });
  });

  it("知らない形のURLは献立一覧にする（壊れた画面を出さない）", () => {
    expect(parseRoute("#/menu")).toEqual({ name: "list" });
    expect(parseRoute("#/menu/m1/unknown")).toEqual({ name: "list" });
    expect(parseRoute("#/menu/m1/order/extra")).toEqual({ name: "list" });
    expect(parseRoute("#/nothing")).toEqual({ name: "list" });
    expect(parseRoute("#/profile/x")).toEqual({ name: "list" });
  });

  it("日本語など記号を含むIDも往復できる", () => {
    const route: Route = { name: "edit", menuId: "献立 1/2", mode: "order" };
    expect(parseRoute(formatRoute(route))).toEqual(route);
  });
});
