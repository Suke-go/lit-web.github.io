# 無料体験予約システム 要件定義書（エンジニア向け / コーディングレベル仕様）

最終更新日: 2025-11-02  
想定実装環境:  
- フロントエンド: 既存コーポレートサイト (静的HTML/CSS/JS or WordPressテーマ内テンプレ etc.)  
- バックエンド: Google Apps Script (GAS) Web App  
- 外部サービス: Google Calendar / Gmail / Google Sheets  
- スタッフ利用ツール: Google Calendar UI（可用枠の登録）  

目的:  
このドキュメントは、VS Code＋AIコーディングアシスタント等で実装を自動化するため、**実装タスクを機械に渡せるレベルまで定義**しつつ、**人間が必ずやるべき領域（認証・権限・運用判断）を明示**する。  

---

## 0. システムのゴール（機能要約）

ユーザーがサイト上のフォームから30分の「無料体験・面談」を予約すると、以下が自動で行われる。

1. ユーザーは「空き枠（2日後〜2週間後）」から30分枠を選べる。  
   - 候補枠は「スタッフがGoogleカレンダー上に `[available ...]` と書いた枠」から自動的に生成される  
   - 30分刻み (`:00` / `:30` 開始のみ)

2. 送信と同時に予約が確定する。  
   - 予約専用カレンダーにGoogle Calendarイベント（30分）が作成される  
   - そのイベントにGoogle Meetリンクが自動添付される  
   - ユーザーのメールアドレスも招待される（カレンダー招待＋メール送信）
   - 担当スタッフにも同じ招待が飛ぶ

3. 担当スタッフは、`[available Muroya,Suzuki]` のような記載からランダムに1名割り当てられる。  
   - `[available Muroya]` → Muroyaさんが担当  
   - `[available Muroya,Suzuki]` → どちらかランダム  
   - `[available]` → デフォルト窓口（例: staff@company.com）

4. 予約内容（ユーザー名、電話番号、予約時間、担当スタッフ、Meetリンクなど）はログとしてスプレッドシートに記録される。

5. もし同じ30分枠が同時に複数人から押された場合は、先着のみ確定。後から来た人には「埋まっちゃいました」メールが自動で送られる。

---

## 1. 用語と構成

### 1.1 カレンダー
- **AVAIL_CAL_ID**  
  - 「可用枠カレンダー」  
  - スタッフが「この時間、対応できます」と宣言するためのカレンダー  
  - イベントタイトルに `[available ...]` を含める必要がある  
  - 例: `[available Muroya,Suzuki] 体験相談OK`  
  - このブロック（例: 19:00〜21:00）を30分単位に分割して候補枠を生成する

- **BOOK_CAL_ID**  
  - 「予約確定カレンダー」  
  - 実際にユーザーとの面談が入る30分イベントをここに作成する  
  - イベントにはGoogle Meetリンクが自動生成される  
  - event.attendeesとしてユーザーと担当スタッフが入る

### 1.2 スタッフテーブル
- GAS内に定義する定数。  
- エイリアス名（`Muroya` など）→ メールアドレス の対応  
- 複数人が対応可能な場合は、このテーブルの中からランダムに1人がアサインされる  
- 例:
  ```javascript
  const STAFF_TABLE = {
    "MUROYA":  { email: "muroya@example.com" },
    "SUZUKI":  { email: "suzuki@example.com" },
    "DEFAULT": { email: "staff@company.com" }
  };
  ```

### 1.3 スロット(slot)
- ユーザーが選べる30分の候補枠1つ  
  - 開始は `...:00` または `...:30` のみ有効  
  - 固定長30分  
  - 期間は「現在から2日後〜14日後（2週間後）」の範囲のみ

### 1.4 ログシート
- 予約結果を記録するGoogleスプレッドシート  
- シート名: `reservations`  
- カラム:
  - `timestamp` (記録時刻)
  - `name`
  - `email`
  - `tel`
  - `startISO`
  - `endISO`
  - `meetLink`
  - `status` (`booked` / `failed` / など)
  - `notes` (担当スタッフなど)

---

## 2. フロントエンド仕様

### 2.1 画面（LP側に埋め込むフォーム）
最低限必要なフォーム要素:

```html
<section id="trialReserveSection">
  <h2>無料体験予約（30分オンライン）</h2>
  <p>ご希望の枠をお選びください。確定後すぐに参加用のGoogle Meetリンクをメールでお送りします。</p>

  <form id="trialForm">
    <label>お名前
      <input type="text" name="name" required />
    </label>

    <label>メールアドレス
      <input type="email" name="email" required />
    </label>

    <label>電話番号
      <input type="tel" name="tel" required />
    </label>

    <label>希望日時（30分枠）
      <select name="slotISO" id="slotSelect" required>
        <option value="">読み込み中...</option>
      </select>
    </label>

    <button id="submitBtn" type="submit">この時間で予約する</button>
  </form>

  <p id="resultMsg" style="display:none;"></p>

  <p class="privacy-note">
    入力いただいた情報は日程調整および当日のご案内以外の目的では利用しません。
  </p>
</section>
```

- `slotSelect` … 空き枠をAPIから自動で注入  
- `resultMsg` … 成功/失敗メッセージ表示領域  
- このフォーム自体は会社サイトのHTMLに埋める（＝Googleフォームは使わない）


### 2.2 空き枠取得の処理（ページロード時）
1. ページロード直後に、GASの `GET /exec?mode=slots` をfetch  
2. 返却JSON（後述）を見て `<select>` の `<option>` を組み立てる  
   - `option.value = startISO`  
   - `option.textContent = "YYYY/MM/DD(曜) HH:MM-HH:MM"`  

```html
<script>
(async function loadSlots() {
  const selectEl = document.getElementById('slotSelect');
  selectEl.innerHTML = '<option value="">読み込み中...</option>';

  try {
    const res = await fetch("https://script.google.com/macros/s/<<<DEPLOY_ID>>>/exec?mode=slots", {
      method: "GET"
    });
    const slots = await res.json(); 
    // slots: [{label: "2025/11/04(火) 19:00-19:30", startISO: "2025-11-04T10:00:00.000Z"}, ...]

    if (!Array.isArray(slots) || slots.length === 0) {
      selectEl.innerHTML = '<option value="">現在予約可能な枠はありません</option>';
      selectEl.disabled = true;
      document.getElementById('submitBtn').disabled = true;
      return;
    }

    selectEl.innerHTML = "";
    for (const s of slots) {
      const opt = document.createElement('option');
      opt.value = s.startISO;
      opt.textContent = s.label;
      selectEl.appendChild(opt);
    }
  } catch (err) {
    console.error(err);
    selectEl.innerHTML = '<option value="">取得エラー</option>';
  }
})();
</script>
```


### 2.3 予約送信処理（フォームsubmit時）
1. ブラウザでバリデーション（空欄チェック）  
2. `POST /exec?mode=book` にJSONで送信  
3. レスポンスに応じてメッセージ表示

```html
<script>
document.getElementById('trialForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const form = ev.target;
  const resultMsg = document.getElementById('resultMsg');
  const btn = document.getElementById('submitBtn');

  btn.disabled = true;
  resultMsg.style.display = "none";
  resultMsg.textContent = "";

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    tel: form.tel.value.trim(),
    slotISO: form.slotISO.value
  };

  // 簡易バリデーション
  if (!payload.name || !payload.email || !payload.tel || !payload.slotISO) {
    btn.disabled = false;
    resultMsg.style.display = "block";
    resultMsg.textContent = "未入力の項目があります。";
    return;
  }

  try {
    const res = await fetch("https://script.google.com/macros/s/<<<DEPLOY_ID>>>/exec?mode=book", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    resultMsg.style.display = "block";
    resultMsg.textContent = data.message || "エラーが発生しました。";

    if (data.status === "ok") {
      // 確定: 入力をロック
      Array.from(form.elements).forEach(el => el.disabled = true);
    } else {
      // 失敗（枠が埋まったなど）: ボタンを再度押せるように
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    resultMsg.style.display = "block";
    resultMsg.textContent = "通信エラーが発生しました。お手数ですが再度お試しください。";
    btn.disabled = false;
  }
});
</script>
```

---

## 3. GAS（バックエンド）仕様

### 3.1 プロジェクト内の定数
人間が入れるべきもの（AIが勝手に決めてはいけないやつ）：
```javascript
const AVAIL_CAL_ID  = "<<<AVAIL_CAL_ID>>>";        // 可用枠カレンダーID
const BOOK_CAL_ID   = "<<<BOOK_CAL_ID>>>";         // 予約カレンダーID
const RESP_SHEET_ID = "<<<RESP_SHEET_ID>>>";       // ログ用スプレッドシートID
const TIMEZONE      = "Asia/Tokyo";
const MEETING_LENGTH_MIN = 30;

// スタッフ割り当て表（担当のメールアドレス）
const STAFF_TABLE = {
  "MUROYA":  { email: "muroya@example.com" },
  "SUZUKI":  { email: "suzuki@example.com" },
  "DEFAULT": { email: "staff@company.com" }
};
```

### 3.2 公開エンドポイント
- `doGet(e)`  
  - `mode=slots` → 空き枠リストを返す（JSON配列）  
  - 他 → ヘルスチェック的なJSON

- `doPost(e)`  
  - `mode=book` → 予約確定処理  
  - それ以外はエラーJSON

### 3.3 CORSポリシー
`jsonResponse()` ヘルパーでCORSヘッダを付与する。
```javascript
function jsonResponse(obj) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // ここで許可するOriginは本番ドメインのみ
  output.setHeader("Access-Control-Allow-Origin", "https://<<<PRODUCTION_SITE_DOMAIN>>>");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type");

  return output;
}
```

※ `<<<PRODUCTION_SITE_DOMAIN>>>` は人間が決める。  
※ 開発中は一時的に localhost を許す等もありえるが、本番は絶対に絞る。

### 3.4 スロット候補の生成
`[available ...]` タイトルのイベントから「2日後〜2週間後」の30分枠を抽出する。

仕様:
- 2日後の0:00を下限  
- 14日後の23:59を上限  
- イベント内のブロック（例: 19:00〜21:00）を30分ステップで割る  
- スタートは `:00` または `:30` 以外は無視  
- 既にBOOK_CAL_IDに予約済み（重複）な枠は除外  
- 1つの時間帯に複数の `[available ...]` が重なっていたらスタッフ候補を結合（後述）

内部構造:
```javascript
// "2025/11/04(火) 19:00-19:30" のような人間向け表記を返す
function formatSlotLabel(startDate, endDate) {
  const youbi = ["日","月","火","水","木","金","土"];
  const yyyy = startDate.getFullYear();
  const mm   = ('0'+(startDate.getMonth()+1)).slice(-2);
  const dd   = ('0'+ startDate.getDate()).slice(-2);
  const wd   = youbi[startDate.getDay()];
  const sh   = ('0'+ startDate.getHours()).slice(-2);
  const sm   = ('0'+ startDate.getMinutes()).slice(-2);
  const eh   = ('0'+ endDate.getHours()).slice(-2);
  const em   = ('0'+ endDate.getMinutes()).slice(-2);
  return `${yyyy}/${mm}/${dd}(${wd}) ${sh}:${sm}-${eh}:${em}`;
}

// "[available Muroya,Suzuki]" から ["MUROYA","SUZUKI"] を取り出す
function extractStaffAliasesFromTitle(title) {
  // 想定フォーマット:
  // [available Muroya,Suzuki] ...
  // [available Muroya] ...
  // [available] ...
  const m = title.match(/^\[available([^\]]*)\]/i);
  if (!m) return [];

  const raw = m[1] || ""; // " Muroya,Suzuki"
  const cleaned = raw.replace(/^[\s:,-]+/, ""); // 先頭の余分な記号・スペース除去
  if (!cleaned) return []; // 名前なし（=誰でもOK扱い）

  return cleaned
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.toUpperCase()); // STAFF_TABLEキーは大文字に揃える
}

// includeStaffInfo = true のときだけスタッフ情報も返す
function getCandidateSlots(includeStaffInfo) {
  const now = new Date();

  const startWindow = new Date(now.getTime() + 2 * 24*60*60*1000); // +2日
  startWindow.setHours(0,0,0,0);

  const endWindow = new Date(now.getTime() + 14 * 24*60*60*1000); // +14日
  endWindow.setHours(23,59,59,999);

  const availCal = CalendarApp.getCalendarById(AVAIL_CAL_ID);
  const allAvailEvents = availCal.getEvents(startWindow, endWindow);

  // [available ...] のみ対象
  const availEvents = allAvailEvents.filter(ev => {
    const t = ev.getTitle() || "";
    return t.match(/^\[available/i);
  });

  // 予約済み枠を取得
  const bookCal = CalendarApp.getCalendarById(BOOK_CAL_ID);
  const bookedEvents = bookCal.getEvents(startWindow, endWindow);
  const bookedRanges = bookedEvents.map(ev => ({
    start: ev.getStartTime().getTime(),
    end:   ev.getEndTime().getTime()
  }));

  let slotsDetailed = [];

  for (const ev of availEvents) {
    const blockStart = ev.getStartTime();
    const blockEnd   = ev.getEndTime();
    const staffList  = extractStaffAliasesFromTitle(ev.getTitle() || "");

    for (let t = new Date(blockStart.getTime());
         t < blockEnd;
         t = new Date(t.getTime() + 30*60*1000)) {

      // :00 or :30以外は無視
      const mins = t.getMinutes();
      if (mins !== 0 && mins !== 30) continue;

      const slotStart = new Date(t.getTime());
      const slotEnd   = new Date(t.getTime() + MEETING_LENGTH_MIN*60*1000);

      if (slotEnd > blockEnd) break; // ブロック終端をはみ出したら終了

      // 予約済みと衝突していないか？
      const conflict = bookedRanges.some(r =>
        !(slotEnd.getTime() <= r.start || slotStart.getTime() >= r.end)
      );
      if (conflict) continue;

      const slotStartISO = slotStart.toISOString();
      const label = formatSlotLabel(slotStart, slotEnd);

      const existing = slotsDetailed.find(s => s.startISO === slotStartISO);
      if (existing) {
        // 同じ時刻枠が複数イベントにまたがる場合 → スタッフ候補マージ
        existing.staffAliases = Array.from(new Set(
          existing.staffAliases.concat(staffList)
        ));
      } else {
        slotsDetailed.push({
          startISO: slotStartISO,
          label: label,
          staffAliases: staffList // ["MUROYA","SUZUKI"] / []
        });
      }
    }
  }

  // 時間順ソート
  slotsDetailed.sort((a,b) => new Date(a.startISO) - new Date(b.startISO));

  // フロント公開用はstaffAliasesを隠す
  if (!includeStaffInfo) {
    return slotsDetailed.map(s => ({
      label: s.label,
      startISO: s.startISO
    }));
  } else {
    return slotsDetailed;
  }
}
```

### 3.5 担当スタッフの決定ロジック
- 候補が1人 → その人  
- 候補が複数 → ランダム  
- 候補が0人 → `DEFAULT`

```javascript
function chooseStaff(staffAliases) {
  let candidates = [];

  if (staffAliases && staffAliases.length > 0) {
    candidates = staffAliases
      .map(alias => alias.toUpperCase())
      .filter(alias => STAFF_TABLE[alias])
      .map(alias => ({ alias, email: STAFF_TABLE[alias].email }));
  }

  if (candidates.length === 0) {
    candidates = [{ alias: "DEFAULT", email: STAFF_TABLE["DEFAULT"].email }];
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick; // { alias: "MUROYA", email: "muroya@example.com" }
}
```

### 3.6 予約確定フロー (`handleBooking`)
1. フロントから `{name,email,tel,slotISO}` がPOSTされる  
2. `slotISO` をDateに変換し、30分後のendを算出  
3. 最新の候補スロット(getCandidateSlots(true))から該当slotを探す  
   - なければ「埋まりました」扱い  
4. `isSlotStillFreeForBooking(start,end)`で競合チェック  
   - 競合なら「埋まりました」扱い  
5. スタッフを`chooseStaff()`で決める  
6. カレンダーイベントを作成  
   - attendees = [ユーザー, 選ばれたスタッフ]  
   - Google Meetリンクを自動生成  
7. ユーザーに「確定しました」メール  
8. スプレッドシートにログ

```javascript
function handleBooking(data) {
  const name    = (data.name    || "").trim();
  const email   = (data.email   || "").trim();
  const tel     = (data.tel     || "").trim();
  const slotISO = (data.slotISO || "").trim();

  if (!name || !email || !tel || !slotISO) {
    return {
      status: "error",
      message: "必須項目が未入力です。"
    };
  }

  const start = new Date(slotISO);
  const end   = new Date(start.getTime() + MEETING_LENGTH_MIN*60*1000);

  // 1. スロットがまだ有効か確認（最新情報で）
  const allSlots = getCandidateSlots(true); // staffAliases付き
  const slotObj  = allSlots.find(s => s.startISO === start.toISOString());

  if (!slotObj) {
    // すでに枠が消えた
    sendSorryMail(name, email);
    logReservation({
      name, email, tel,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: "",
      status: "failed",
      notes: "slot_no_longer_available"
    });
    return {
      status: "error",
      reason: "slot_taken",
      message: "大変申し訳ありません、その時間は埋まりました。別の時間をお選びください。"
    };
  }

  // 2. 競合チェック（二重予約防止）
  if (!isSlotStillFreeForBooking(start, end)) {
    sendSorryMail(name, email);
    logReservation({
      name, email, tel,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: "",
      status: "failed",
      notes: "slot_conflict"
    });
    return {
      status: "error",
      reason: "slot_taken",
      message: "大変申し訳ありません、その時間は埋まりました。別の時間をお選びください。"
    };
  }

  // 3. スタッフ決定
  const assigned = chooseStaff(slotObj.staffAliases); 
  // { alias:"MUROYA", email:"muroya@example.com" }

  // 4. カレンダーにイベント作成 + Meetリンク生成
  const bookedInfo = createBookedEventWithStaff(start, end, name, email, tel, assigned.email);

  // 5. 確定メール送信（ユーザー向け）
  sendConfirmMail(name, email, start, end, bookedInfo.meetLink);

  // 6. ログ記録
  logReservation({
    name, email, tel,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    meetLink: bookedInfo.meetLink,
    status: "booked",
    notes: `staff=${assigned.alias}|${assigned.email}`
  });

  return {
    status: "ok",
    message: "予約が確定しました。メールをご確認ください。"
  };
}
```

### 3.7 二重予約防止
```javascript
function isSlotStillFreeForBooking(start, end) {
  const cal = CalendarApp.getCalendarById(BOOK_CAL_ID);
  const hits = cal.getEvents(start, end);
  return hits.length === 0;
}
```

### 3.8 カレンダーイベント作成（Google Meet付き）
```javascript
function createBookedEventWithStaff(start, end, name, email, tel, staffEmail) {
  const event = {
    summary: `無料体験／${name}さん`,
    description: `電話番号: ${tel}
この予約はWebフォームから自動登録されました。`,
    start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
    end:   { dateTime: end.toISOString(),   timeZone: TIMEZONE },
    attendees: [
      { email: email },      // ユーザー
      { email: staffEmail }  // 担当スタッフ
    ],
    conferenceData: {
      createRequest: {
        requestId: Utilities.getUuid(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  const created = Calendar.Events.insert(
    event,
    BOOK_CAL_ID,
    { conferenceDataVersion: 1 }
  );

  const meetLink =
    created.hangoutLink ||
    (created.conferenceData &&
     created.conferenceData.entryPoints &&
     created.conferenceData.entryPoints[0] &&
     created.conferenceData.entryPoints[0].uri) ||
    "";

  return { meetLink };
}
```

### 3.9 メール通知
```javascript
function sendConfirmMail(name, email, start, end, meetLink) {
  const subject = "【予約確定】無料体験のご案内";
  const body =
`${name} 様

無料体験の日時が確定しました。

日時: ${formatSlotLabel(start, end)}
所要時間: 約${MEETING_LENGTH_MIN}分
オンライン（Google Meet）:
${meetLink}

当日は上記リンクからご入室ください。
ご都合が悪い場合はこのメールにご返信ください。

よろしくお願いいたします。
`;

  GmailApp.sendEmail(email, subject, body);
}

function sendSorryMail(name, email) {
  const subject = "【日程調整のお願い】無料体験について";
  const body =
`${name} 様

無料体験のお申し込みありがとうございます。
申し訳ございませんが、ご希望の時間が他の方の予約と重なってしまいました。

お手数ですが、他の候補日時を2〜3つご返信いただけますでしょうか。
担当より折り返しご連絡いたします。

よろしくお願いいたします。
`;

  GmailApp.sendEmail(email, subject, body);
}
```

### 3.10 ログ保存
```javascript
function logReservation(params) {
  const ss    = SpreadsheetApp.openById(RESP_SHEET_ID);
  const sheet = ss.getSheetByName("reservations");
  sheet.appendRow([
    new Date(),               // timestamp
    params.name,
    params.email,
    params.tel,
    params.startISO,
    params.endISO,
    params.meetLink,
    params.status,
    params.notes
  ]);
}
```

### 3.11 doGet / doPost 本体
```javascript
function doGet(e) {
  const mode = e.parameter.mode;

  if (mode === "slots") {
    // フロント公開用：スタッフ情報なし
    const slotsForClient = getCandidateSlots(false);
    return jsonResponse(slotsForClient);
  }

  return jsonResponse({status:"ok", message:"alive"});
}

function doPost(e) {
  const mode = e.parameter.mode;

  if (mode === "book") {
    const data = JSON.parse(e.postData.contents || "{}");
    const result = handleBooking(data);
    return jsonResponse(result);
  }

  return jsonResponse({status:"error", message:"unknown mode"});
}
```

---

## 4. セキュリティ・権限に関する人間側タスク（AIには任せない）

このシステムでは、**人間が責任者としてやらないといけない手順**がある。  
AIに自動でやらせないことを明記する。

### 4.1 代表アカウントの決定
- どのGoogleアカウントでGASを動かすか決める  
  - これがメール送信者にもなる  
  - これがカレンダーイベントの作成者にもなる  
- 法務・情報管理の観点から「個人アカじゃなくて部署用の共通アカ（例: booking@company.com）でやる」が望ましい  
- これは人間の承認が必要

### 4.2 カレンダー権限の付与
- `AVAIL_CAL_ID`: スタッフが予定を入れられるよう編集権限  
- `BOOK_CAL_ID`: GASの実行アカウントに「予定作成可」の権限  
- 権限付与はGoogle Calendarの共有設定UIで人間が行う  
- これは社内の誰が顧客情報を閲覧可能か決める話なので、AIに勝手にやらせてはいけない

### 4.3 Advanced Services有効化
- Apps Scriptのプロジェクトで「高度なGoogleサービス > Calendar API」をONにする  
- Calendar.Events.insert が使えるようにする  
- これも「このスクリプトにカレンダー編集権限を与える」行為なので人が許諾する

### 4.4 CORSドメインの確定
- `jsonResponse()` の `Access-Control-Allow-Origin` に許可するドメイン（本番LPドメイン）を明示的に書く  
- これは「どこからのJSがこのAPIを叩けるか」の決定権  
- 緩く `*` を入れるのはNG  
- 本番は必ず1ドメインに固定。テスト時にlocalhostを一時的に許す場合も、責任者の合意が必要

### 4.5 スタッフテーブルの管理
- `STAFF_TABLE` は人的リソース表なので、メールアドレスや担当名が正しいか、人間が保証する  
- このテーブルが間違うと、間違った人に顧客情報が飛ぶ（＝情報漏えい）

### 4.6 プライバシーポリシー・同意文言
- フロントフォームの下にある「この情報は日程調整に使用します」などの文言はリーガルチェック必須  
- メール本文の敬称・内容もサービストーンとして最終確認が必要  
- AIがドラフトを書くのはOKだが、最終は人間が承認する

---

## 5. 運用フロー（現場側）

1. スタッフが可用枠カレンダー(AVAIL_CAL_ID)に予定を入れる  
   - 例:  
     タイトル: `[available Muroya,Suzuki] 体験可能`  
     時間: 2025/11/04 19:00〜21:00  
   - この2時間ブロックから、`19:00-19:30 / 19:30-20:00 / 20:00-20:30 / 20:30-21:00` のスロットが自動候補になる

2. ユーザーがLPから送信すると、その場でBOOK_CAL_IDに30分予定が作成される  
   - イベント名: `無料体験／◯◯さん`  
   - attendees:  
     - ユーザーのメール  
     - 割り当てられたスタッフのメール（ランダムに1人）  
   - Google Meetリンク自動発行済み  
   - ユーザーと担当スタッフそれぞれにカレンダー招待が飛ぶ

3. ログはスプレッドシート`reservations`に残る  
   - 誰が担当になったか (`notes`列に `staff=MUROYA|muroya@example.com`)  
   - 問題があれば、ここを見て人間が対応する

4. 同じ時間帯を別の人が送信すると、後の人は「埋まりました」メールを自動で受け取る  
   - 競合管理はサーバー側で勝手にやる  
   - 運用側での手作業は不要

5. キャンセル・リスケは現時点では人間がメールで対応する  
   - BOOK_CAL_IDから該当イベントを削除する  
   - スプレッドシートでstatus=`canceled`等をメモる  
   - ここは後続で自動化できる拡張ポイント

---

## 6. 実装チェックリスト

### フロント
- [ ] 予約フォームHTMLを実装（`trialForm`, `slotSelect`, etc.）  
- [ ] ページロード時の `loadSlots()` を実装  
- [ ] `submit` 時に POST するJSを実装  
- [ ] resultMsg 等のUI表示を整える  
- [ ] プライバシー文言を掲載（人間が承認）

### GAS
- [ ] 定数 (`AVAIL_CAL_ID`, `BOOK_CAL_ID`, `RESP_SHEET_ID`, `STAFF_TABLE`, `<<<PRODUCTION_SITE_DOMAIN>>>`) を埋める  
- [ ] `doGet`, `doPost`, `jsonResponse`, `getCandidateSlots`, `handleBooking` 等をペースト  
- [ ] Advanced Google ServicesでCalendar APIを有効化  
- [ ] Webアプリとして `誰でも` アクセス可でデプロイ（URLをフロントに貼る）  
  - ※CORSでドメインを絞っていることを確認

### Google Workspace側（人間タスク）
- [ ] 代表アカウントを決定（このアカがGASオーナーになる）  
- [ ] `AVAIL_CAL_ID`, `BOOK_CAL_ID` カレンダーを作成しID控える  
- [ ] そのカレンダーに代表アカウントが正しい権限を持っているか確認  
- [ ] ログ用スプレッドシート`reservations`を作り、`RESP_SHEET_ID` を控える  
- [ ] スタッフのメールアドレスとエイリアス（MUROYAなど）を決め、`STAFF_TABLE` に入れる  
- [ ] CORSで許可するドメイン（本番ドメイン）を決定し、`jsonResponse()` に設定

---

## 7. 拡張の余地（将来のTODO）

- キャンセルURLを含めた自動キャンセルフロー  
  - クリック時にBOOK_CAL_IDの該当イベントを削除  
  - スプレッドシートを`canceled`に更新  
  - スタッフへキャンセル通知メールを送る

- 複数サービスメニューへの拡張  
  - 「30分体験」「60分詳細相談」など枠の長さが違う場合は `MEETING_LENGTH_MIN` を可変にする  
  - 予約POST時にサービス種別を送る

- スパム対策  
  - reCAPTCHAトークンをフォーム送信と一緒にPOST  
  - GAS側でトークン検証  
  - 同じメール/電話が短時間に10件などのリミットチェック

---

## 8. まとめ

- コードそのもの（関数本体、DOM操作、fetchロジック、JSON整形、スロット生成ロジック、ランダム担当アサイン、Google Calendar Events.insert呼び出し、GmailApp.sendEmail、ログsheet.appendRow）はAIコーディングに任せて自動生成・整形できる領域。

- 一方で、**絶対に人間じゃないと決められないし承認できない部分**は以下のもの：
  1. どのGoogleアカウントを公式送信者にするか（＝誰名義でユーザーにメールが飛ぶのか）  
  2. どのカレンダーを「予約確定カレンダー」として使うか（顧客情報を含む）  
  3. CORSで許可する本番ドメインはどこか  
  4. スタッフ名とメールアドレスのマッピング（STAFF_TABLE）  
  5. フォームの同意文・メール文面などの対外コミュニケーション

- これらを人間が先に確定して与えれば、AIコーディングに「この定数を埋めた状態のCode.gsを生成して」「このHTMLとJSを吐いて」といった具体命令を投げるだけで、実装はほぼ機械に書かせられる。

このドキュメントをプロジェクトの要件定義書（md）としてリポジトリに置けば、以後は  
「人間が何をやる必要があるのか」  
「AIにどこまでやらせていいのか」  
がズレずに進められる。
