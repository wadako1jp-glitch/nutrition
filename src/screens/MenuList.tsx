// 献立一覧（最初の画面）。献立を開く・新しく作る・削除する、合計・充足率に使う献立をチェックで選ぶ。
import { useEffect, useMemo, useState } from "react";
import { Food, findByCode, loadFoods } from "../data/foods";
import { computeRow, round1, sumRows } from "../core/nutrition";
import { weightValue } from "../core/weightInput";
import { StoredMenu, deleteMenu, listMenus } from "../lib/storage/menus";

export default function MenuList({
  onOpen,
  onCreate,
  selectedIds,
  onSelectedChange,
  onOpenSummary,
  onOpenProfile,
}: {
  onOpen: (id: string) => void;
  onCreate: () => void;
  selectedIds: string[]; // 合計・充足率の対象として選んだ献立
  onSelectedChange: (ids: string[]) => void;
  onOpenSummary: () => void;
  onOpenProfile: () => void;
}) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [menus, setMenus] = useState<StoredMenu[] | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadFoods().then(setFoods);
    refresh();
  }, []);

  function refresh() {
    listMenus().then((ms) => {
      setMenus(ms);
      // 削除済みの献立が選択に残らないようにする
      const alive = selectedIds.filter((id) => ms.some((m) => m.id === id));
      if (alive.length !== selectedIds.length) onSelectedChange(alive);
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteMenu(id);
      onSelectedChange(selectedIds.filter((x) => x !== id));
    } catch {
      // 削除できなかった（画面下に注意が出る）。一覧は読み直して実際の状態を見せる
    }
    setConfirmDeleteId(null);
    refresh();
  }

  function toggleSelected(id: string) {
    onSelectedChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="list-title">献立一覧</span>
        <button type="button" className="mode-toggle" onClick={onCreate}>
          ＋新しい献立
        </button>
        <button type="button" className="back-btn" onClick={onOpenProfile} aria-label="プロフィール・設定" title="プロフィール・設定">
          ⚙
        </button>
      </header>

      <button type="button" className="summary-open-btn" onClick={onOpenSummary}>
        合計・充足率を見る（{selectedIds.length}件選択中）
      </button>

      {menus === null ? (
        <p className="note">読み込み中…</p>
      ) : menus.length === 0 ? (
        <p className="note">まだ献立がありません。「＋新しい献立」から材料を追加すると、ここに一覧が出ます。</p>
      ) : (
        <ul className="menu-list">
          {menus.map((m) => (
            <MenuListItem
              key={m.id}
              menu={m}
              foods={foods}
              selected={selectedIds.includes(m.id)}
              onToggleSelected={() => toggleSelected(m.id)}
              onOpen={() => onOpen(m.id)}
              onDelete={() => setConfirmDeleteId(m.id)}
            />
          ))}
        </ul>
      )}

      {confirmDeleteId !== null &&
        (() => {
          const target = menus?.find((m) => m.id === confirmDeleteId);
          if (!target) return null;
          return (
            <div className="confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
              <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-title">「{target.title}」を削除しますか？元に戻せません。</div>
                <div className="confirm-actions">
                  <button type="button" className="confirm-cancel" onClick={() => setConfirmDeleteId(null)}>
                    キャンセル
                  </button>
                  <button type="button" className="confirm-delete" onClick={() => handleDelete(target.id)}>
                    削除する
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function MenuListItem({
  menu,
  foods,
  selected,
  onToggleSelected,
  onOpen,
  onDelete,
}: {
  menu: StoredMenu;
  foods: Food[] | null;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const summary = useMemo(() => {
    if (!foods) return null;
    const nutrientRows = menu.rows
      .map((r) => {
        const food = findByCode(foods, r.code);
        if (!food) return null;
        return computeRow(food, weightValue(r.usedWeight));
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const totalWeight = round1(menu.rows.reduce((acc, r) => acc + weightValue(r.usedWeight), 0));
    return { kcal: sumRows(nutrientRows).kcal, totalWeight };
  }, [foods, menu.rows]);

  const updated = new Date(menu.updatedAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className={`menu-item${selected ? " selected" : ""}`}>
      <label className="menu-item-check" title="合計・充足率の対象にする">
        <input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label={`「${menu.title}」を合計の対象にする`} />
      </label>
      <button type="button" className="menu-item-main" onClick={onOpen}>
        <span className="menu-item-title">{menu.title}</span>
        <span className="menu-item-meta">
          材料{menu.rows.length}点
          {summary ? ` ・ 合計${summary.kcal}kcal ・ ${summary.totalWeight}g` : ""} ・ 更新 {updated}
        </span>
      </button>
      <button type="button" className="menu-item-del" onClick={onDelete} aria-label="削除">
        ×
      </button>
    </li>
  );
}
