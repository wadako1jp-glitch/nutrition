import { useEffect, useState } from "react";
import { normalizeWeightInput } from "../core/weightInput";
import { ActivityLevel, Profile, Sex, getProfile, saveProfile } from "../lib/storage/profile";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 1, label: "I（低い）", hint: "生活の大部分が座位で、静的な活動が中心" },
  { value: 2, label: "II（ふつう）", hint: "座位中心だが、通勤・買い物での歩行、家事、軽いスポーツ等を含む" },
  { value: 3, label: "III（高い）", hint: "移動や立位の多い仕事、または活発な運動習慣がある" },
];

function parsePositive(s: string): number | null {
  const n = Number(normalizeWeightInput(s.trim()));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

// 利用者プロフィールの編集（専用画面）。保存すると onDone で呼び出し元の画面に戻る。
export default function ProfileEdit({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      if (!p) return;
      setAge(String(p.age));
      setSex(p.sex);
      setActivity(p.activityLevel);
      setHeight(p.heightCm === null ? "" : String(p.heightCm));
      setWeight(p.weightKg === null ? "" : String(p.weightKg));
    });
  }, []);

  const ageNum = parsePositive(age);
  const ageError = ageNum === null || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120 ? "1〜120の整数で入力してください" : null;
  const heightError = height.trim() !== "" && parsePositive(height) === null ? "正の数で入力してください" : null;
  const weightError = weight.trim() !== "" && parsePositive(weight) === null ? "正の数で入力してください" : null;
  const valid = !ageError && sex !== null && activity !== null && !heightError && !weightError;

  async function handleSave() {
    setSubmitted(true);
    if (!valid || sex === null || activity === null || ageNum === null) return;
    const profile: Profile = {
      age: ageNum,
      sex,
      activityLevel: activity,
      heightCm: parsePositive(height),
      weightKg: parsePositive(weight),
    };
    await saveProfile(profile);
    onDone();
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="back-btn" onClick={onCancel} aria-label="戻る">
          ←
        </button>
        <span className="list-title">プロフィール</span>
      </header>

      <div className="form-card">
        <label className="form-field">
          <span className="form-label">
            年齢<span className="req">必須</span>
          </span>
          <span className="form-input-unit">
            <input value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value)} />歳
          </span>
          {submitted && ageError && <span className="weight-warning">{ageError}</span>}
        </label>

        <div className="form-field">
          <span className="form-label">
            性別<span className="req">必須</span>
          </span>
          <div className="seg">
            {(["male", "female"] as Sex[]).map((s) => (
              <button key={s} type="button" className={sex === s ? "on" : ""} onClick={() => setSex(s)}>
                {s === "male" ? "男性" : "女性"}
              </button>
            ))}
          </div>
          {submitted && sex === null && <span className="weight-warning">選択してください</span>}
        </div>

        <div className="form-field">
          <span className="form-label">
            身体活動レベル<span className="req">必須</span>
          </span>
          <div className="seg seg-col">
            {ACTIVITY_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={activity === o.value ? "on" : ""} onClick={() => setActivity(o.value)}>
                <b>{o.label}</b>
                <small>{o.hint}</small>
              </button>
            ))}
          </div>
          {submitted && activity === null && <span className="weight-warning">選択してください</span>}
        </div>

        <label className="form-field">
          <span className="form-label">身長（任意）</span>
          <span className="form-input-unit">
            <input value={height} inputMode="decimal" onChange={(e) => setHeight(e.target.value)} />cm
          </span>
          {heightError && <span className="weight-warning">{heightError}</span>}
        </label>

        <label className="form-field">
          <span className="form-label">体重（任意）</span>
          <span className="form-input-unit">
            <input value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} />kg
          </span>
          {weightError && <span className="weight-warning">{weightError}</span>}
        </label>

        <button type="button" className="add-card-btn form-save" onClick={handleSave}>
          保存する
        </button>
      </div>

      <p className="note">プロフィールはこの端末内にのみ保存されます。合計・充足率画面で食事摂取基準の区分を選ぶのに使います。</p>
    </div>
  );
}
