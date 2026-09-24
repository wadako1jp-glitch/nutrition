import { useState } from "react";
import DailySummary from "./screens/DailySummary";
import MenuList from "./screens/MenuList";
import ProfileEdit from "./screens/ProfileEdit";
import Worksheet from "./screens/Worksheet";

type View =
  | { name: "list" }
  | { name: "edit"; menuId: string | null }
  | { name: "summary" }
  | { name: "profile"; returnTo: "list" | "summary" };

export default function App() {
  const [view, setView] = useState<View>({ name: "list" });
  // 合計・充足率の対象として献立一覧で選んだ献立（画面を行き来しても保持する）
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (view.name === "edit") {
    return <Worksheet menuId={view.menuId} onBack={() => setView({ name: "list" })} />;
  }

  if (view.name === "profile") {
    const back = () => setView(view.returnTo === "summary" ? { name: "summary" } : { name: "list" });
    return <ProfileEdit onDone={back} onCancel={back} />;
  }

  if (view.name === "summary") {
    return (
      <DailySummary
        menuIds={selectedIds}
        onBack={() => setView({ name: "list" })}
        onEditProfile={() => setView({ name: "profile", returnTo: "summary" })}
      />
    );
  }

  return (
    <MenuList
      onOpen={(id) => setView({ name: "edit", menuId: id })}
      onCreate={() => setView({ name: "edit", menuId: null })}
      selectedIds={selectedIds}
      onSelectedChange={setSelectedIds}
      onOpenSummary={() => setView({ name: "summary" })}
      onOpenProfile={() => setView({ name: "profile", returnTo: "list" })}
    />
  );
}
