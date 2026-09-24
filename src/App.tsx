import { useState } from "react";
import MenuList from "./screens/MenuList";
import Worksheet from "./screens/Worksheet";

type View = { name: "list" } | { name: "edit"; menuId: string | null };

export default function App() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "edit") {
    return (
      <Worksheet
        menuId={view.menuId}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <MenuList
      onOpen={(id) => setView({ name: "edit", menuId: id })}
      onCreate={() => setView({ name: "edit", menuId: null })}
    />
  );
}
