// 画面の切り替え（献立一覧 ⇄ 入力画面 ⇄ 合計・充足率 ⇄ プロフィール・設定）。どの画面を出すかだけを決める。
// 画面ごとにURLがあり（src/lib/route.ts）、スマホの「戻る」で前の画面に戻れる。
import { useRef, useState } from "react";
import { useRoute } from "./hooks/useRoute";
import { createMenuId } from "./lib/storage/menus";
import { LIST_ROUTE } from "./lib/route";
import DailySummary from "./screens/DailySummary";
import MenuList from "./screens/MenuList";
import ProfileEdit from "./screens/ProfileEdit";
import Worksheet from "./screens/worksheet/Worksheet";

export default function App() {
  const { route, navigate, goBack, leave } = useRoute();
  // 合計・充足率の対象として献立一覧で選んだ献立（画面を行き来しても保持する）
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (route.name === "summary" ? route.menuIds : []));
  // この起動中に「新しい献立」で作った献立ID（まだ保存されていなくても新規として開く）
  const newMenuIdsRef = useRef(new Set<string>());

  if (route.name === "edit") {
    return (
      <Worksheet
        key={route.menuId}
        menuId={route.menuId}
        isNew={newMenuIdsRef.current.has(route.menuId)}
        mode={route.mode}
        onModeChange={(mode) => navigate({ ...route, mode }, true)}
        onModeClose={() => goBack({ ...route, mode: "sheet" })}
        onBack={() => leave(LIST_ROUTE)}
      />
    );
  }

  if (route.name === "profile") {
    const back = () => goBack(LIST_ROUTE);
    return <ProfileEdit onDone={back} onCancel={back} />;
  }

  if (route.name === "summary") {
    return (
      <DailySummary
        menuIds={route.menuIds}
        onBack={() => goBack(LIST_ROUTE)}
        onEditProfile={() => navigate({ name: "profile" })}
      />
    );
  }

  return (
    <MenuList
      onOpen={(id) => navigate({ name: "edit", menuId: id, mode: "sheet" })}
      onCreate={() => {
        const id = createMenuId();
        newMenuIdsRef.current.add(id);
        navigate({ name: "edit", menuId: id, mode: "sheet" });
      }}
      selectedIds={selectedIds}
      onSelectedChange={setSelectedIds}
      onOpenSummary={() => navigate({ name: "summary", menuIds: selectedIds })}
      onOpenProfile={() => navigate({ name: "profile" })}
    />
  );
}
