/**
 * 無料体験予約フロー（Google Apps Script バックエンド）
 *
 * ⚠️ 以下の定数は実際の環境に合わせて必ず更新してください。
 *  - AVAIL_CAL_ID      : 可用枠を登録するカレンダーID
 *  - BOOK_CAL_ID       : 予約確定イベントを書き込むカレンダーID
 *  - RESP_SHEET_ID     : ログ保存先スプレッドシートID
 *  - PRODUCTION_ORIGIN : フロントエンドを配信する本番ドメイン（https://を含む）
 *  - STAFF_TABLE       : スタッフのエイリアスとメールアドレスの紐付け
 *
 * カレンダーIDやシートIDはユーザーが管理し、AIが勝手に埋めない想定です。
 */

const AVAIL_CAL_ID = "f2b7f80f922816e3fc37245607d5816163575a8426691a8a70436bde3cd5e6cd@group.calendar.google.com";
const BOOK_CAL_ID = "litable.official@gmail.com";
const RESP_SHEET_ID = "1Xn145JXyBmFoj9yMXMkOCmoAh-OLN8IhQ5uT1VBebU8";
const PRODUCTION_ORIGIN = "https://careercoaching.litable-edu.com";
const PREVIEW_ORIGIN = "https://ksk432.com";
const ALLOWED_ORIGINS = Object.freeze([
  PRODUCTION_ORIGIN,
  PREVIEW_ORIGIN,
  "https://lp.careercoaching.litable-edu.com", // 旧ドメインも念のため維持
  "https://ksk432.github.io",                // GitHub Pagesのオリジン
  "https://lit-web.github.io",               // リポジトリ名由来の可能性も考慮
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5501",
]);
const TIMEZONE = "Asia/Tokyo";
const MEETING_LENGTH_MIN = 30;

const STAFF_TABLE = Object.freeze({
  室谷: { email: "shun.muroya@litable-edu.com" },
  清水: { email: "kosuke.shimizu@litable-edu.com" },
  DEFAULT: { email: "litable.official@gmail.com" },
});

const YOU_BI = ["日", "月", "火", "水", "木", "金", "土"];
const RESULT_STATUSES = Object.freeze(["success", "error", "warning"]);
const CONTACT_METHODS = Object.freeze({
  MEET: "meet",
  PHONE: "phone",
});

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";

function resolveAllowedOrigin(origin) {
  if (!origin) return PRODUCTION_ORIGIN;

  // Normalize to pure origin (scheme + host [+ port]) so paths or trailing slashes do not break comparison.
  var match = String(origin).match(/^https?:\/\/[^/]+/i);
  var normalized = match ? match[0] : origin;
  normalized = normalized.replace(/\/+$/, "");

  if (ALLOWED_ORIGINS.indexOf(normalized) !== -1) return normalized;
  return PRODUCTION_ORIGIN;
}

function withCors(body, options) {
  options = options || {};
  var originHeader = options.origin || "";
  var allowedOrigin = resolveAllowedOrigin(originHeader);
  var contentType = options.contentType || JSON_CONTENT_TYPE;
  var output = ContentService.createTextOutput(body || "");
  var mimeType = ContentService.MimeType.TEXT;
  if (/json/i.test(contentType)) {
    mimeType = ContentService.MimeType.JSON;
  }
  output.setMimeType(mimeType);

  if (typeof output.setHeader === "function") {
    output.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    output.setHeader("Access-Control-Allow-Headers", "Content-Type");
    output.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    output.setHeader("Vary", "Origin");

    var extraHeaders = options.headers || {};
    Object.keys(extraHeaders).forEach(function (key) {
      output.setHeader(key, extraHeaders[key]);
    });
  } else {
    console.warn("setHeader API is unavailable in this runtime; falling back to default headers.");
  }

  if (options.statusCode && typeof output.setStatusCode === "function") {
    output.setStatusCode(options.statusCode);
  }

  return output;
}

function jsonResponse(obj, origin) {
  return withCors(JSON.stringify(obj), { origin: origin, contentType: JSON_CONTENT_TYPE });
}

function formatSlotLabel(startDate, endDate) {
  const pad = (num) => ("0" + num).slice(-2);
  const yyyy = startDate.getFullYear();
  const mm = pad(startDate.getMonth() + 1);
  const dd = pad(startDate.getDate());
  const wd = YOU_BI[startDate.getDay()];
  const sh = pad(startDate.getHours());
  const sm = pad(startDate.getMinutes());
  const eh = pad(endDate.getHours());
  const em = pad(endDate.getMinutes());
  return `${yyyy}/${mm}/${dd}(${wd}) ${sh}:${sm}-${eh}:${em}`;
}

function extractStaffAliasesFromTitle(title) {
  if (!title) return [];
  const match = title.match(/^\[available([^\]]*)\]/i);
  if (!match) return [];

  const raw = match[1] || "";
  const cleaned = raw.replace(/^[\s:,-]+/, "");
  if (!cleaned) return [];

  return cleaned
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toUpperCase());
}

function getCandidateSlots(includeStaffInfo) {
  const now = new Date();

  const startWindow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  startWindow.setHours(0, 0, 0, 0);

  const endWindow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  endWindow.setHours(23, 59, 59, 999);

  const availCal = CalendarApp.getCalendarById(AVAIL_CAL_ID);
  if (!availCal) {
    console.error("Available calendar not found. Check AVAIL_CAL_ID.");
    return [];
  }

  const bookCal = CalendarApp.getCalendarById(BOOK_CAL_ID);
  if (!bookCal) {
    console.error("Booking calendar not found. Check BOOK_CAL_ID.");
    return [];
  }

  const allAvailEvents = availCal.getEvents(startWindow, endWindow);
  const availEvents = allAvailEvents.filter((ev) => {
    return /^\[available/i.test(ev.getTitle() || "");
  });

  const bookedEvents = bookCal.getEvents(startWindow, endWindow);
  const bookedRanges = bookedEvents.map((ev) => ({
    start: ev.getStartTime().getTime(),
    end: ev.getEndTime().getTime(),
  }));

  const slotsDetailed = [];
  const slotMap = {};

  const slotLengthMs = MEETING_LENGTH_MIN * 60 * 1000;

  availEvents.forEach((ev) => {
    const blockStart = ev.getStartTime();
    const blockEnd = ev.getEndTime();
    const staffList = extractStaffAliasesFromTitle(ev.getTitle() || "");

    for (
      let t = new Date(blockStart.getTime());
      t.getTime() + slotLengthMs <= blockEnd.getTime();
      t = new Date(t.getTime() + slotLengthMs)
    ) {
      const minutes = t.getMinutes();
      if (minutes !== 0 && minutes !== 30) {
        continue;
      }

      const slotStart = new Date(t.getTime());
      const slotEnd = new Date(t.getTime() + slotLengthMs);

      const conflict = bookedRanges.some((range) => {
        return !(slotEnd.getTime() <= range.start || slotStart.getTime() >= range.end);
      });

      if (conflict) {
        continue;
      }

      const slotStartISO = slotStart.toISOString();

      let slot = slotMap[slotStartISO];
      if (!slot) {
        slot = {
          startISO: slotStartISO,
          endISO: slotEnd.toISOString(),
          label: formatSlotLabel(slotStart, slotEnd),
          staffAliases: [],
        };
        slotMap[slotStartISO] = slot;
        slotsDetailed.push(slot);
      }

      if (staffList.length > 0) {
        const merged = slot.staffAliases.concat(staffList);
        slot.staffAliases = Array.from(new Set(merged));
      }
    }
  });

  slotsDetailed.sort((a, b) => {
    if (a.startISO < b.startISO) return -1;
    if (a.startISO > b.startISO) return 1;
    return 0;
  });

  if (includeStaffInfo) {
    return slotsDetailed;
  }

  return slotsDetailed.map((slot) => ({
    startISO: slot.startISO,
    endISO: slot.endISO,
    label: slot.label,
  }));
}

function chooseStaff(staffAliases) {
  let candidates = [];

  if (staffAliases && staffAliases.length > 0) {
    candidates = staffAliases
      .map((alias) => alias.toUpperCase())
      .filter((alias) => STAFF_TABLE[alias])
      .map((alias) => ({
        alias: alias,
        email: STAFF_TABLE[alias].email,
      }));
  }

  if (candidates.length === 0) {
    candidates = [
      { alias: "DEFAULT", email: STAFF_TABLE.DEFAULT.email },
    ];
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick;
}

function isSlotStillFreeForBooking(start, end) {
  const cal = CalendarApp.getCalendarById(BOOK_CAL_ID);
  if (!cal) {
    console.error("Booking calendar not found when checking conflicts.");
    return false;
  }
  const hits = cal.getEvents(start, end);
  return hits.length === 0;
}

function createBookedEventWithStaff(options) {
  var start = options.start;
  var end = options.end;
  var name = options.name;
  var email = options.email;
  var tel = options.tel;
  var staffEmail = options.staffEmail;
  var contactMethod = options.contactMethod || CONTACT_METHODS.MEET;

  if (typeof Calendar === "undefined" || !Calendar.Events || !Calendar.Events.insert) {
    throw new Error("Calendar advanced service is not enabled. Enable it before deployment.");
  }

  const event = {
    summary: `無料体験／${name}さん`,
    description: `電話番号: ${tel}
この予約はWebフォームから自動登録されました。`,
    start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    attendees: [
      { email: email },
      { email: staffEmail },
    ],
    description: `電話番号: ${tel}
連絡方法: ${contactMethod === CONTACT_METHODS.PHONE ? "電話（フォーム指定）" : "Google Meet"}
この予約はWebフォームから自動登録されました。`,
  };

  if (contactMethod !== CONTACT_METHODS.PHONE) {
    event.conferenceData = {
      createRequest: {
        requestId: Utilities.getUuid(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const insertOptions =
    contactMethod !== CONTACT_METHODS.PHONE
      ? { conferenceDataVersion: 1 }
      : {};

  const created = Calendar.Events.insert(event, BOOK_CAL_ID, insertOptions);

  const meetLink =
    created.hangoutLink ||
    (created.conferenceData &&
      created.conferenceData.entryPoints &&
      created.conferenceData.entryPoints[0] &&
      created.conferenceData.entryPoints[0].uri) ||
    "";

  return { meetLink: contactMethod === CONTACT_METHODS.PHONE ? "" : meetLink };
}

function sendConfirmMail(name, email, start, end, meetLink, contactMethod) {
  const subject = "【予約確定】高校生キャリアコーチング保護者説明会";

  const isMeet = contactMethod !== CONTACT_METHODS.PHONE;
  const contactLine = isMeet
    ? `■ 実施形式：個別（1対1）オンライン（Google Meetを利用いたします）`
    : `■ 実施形式：個別（1対1）お電話`;
  const accessLine = isMeet
    ? `■ ご参加用URL：${meetLink || "日程確定後、別途ご案内いたします"}`
    : `■ ご連絡方法：担当コーチよりお電話いたします`;
  const guideLine = isMeet
    ? "本説明会はGoogle Meetを使用して実施いたします。開始時刻になりましたら、上記URLよりご入室ください。"
    : "当日はご指定のお電話番号宛に担当コーチよりご連絡いたします。";

  const body = `${name} 様

この度は、高校生キャリアコーチング保護者説明会にお申込みいただき、誠にありがとうございます。

説明会は、個別（1対1）のオンライン形式で、45分程度を予定しております。
当日はGoogle Meetを使用して実施いたします。

■ 日時：${formatSlotLabel(start, end)}
■ 所要時間：約${MEETING_LENGTH_MIN}分
${contactLine}
${accessLine}

${guideLine}
ご都合が悪い場合や日程変更をご希望の際は、お手数ですが下記までご連絡ください。
TEL：050-8890-0466
Email：litable.official@gmail.com

お忙しいところ恐れ入りますが、ご確認のうえご返信をお待ちしております。

＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊
株式会社Litable
室谷 駿
TEL：050-8890-0466
Email：shun.muroya@litable-edu.com
WEB：https://litable-edu.com/
＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊
`;

  GmailApp.sendEmail(email, subject, body, {
    bcc: "litable.official@gmail.com",
    name: "株式会社Litable",
  });
}

function sendInternalNotification(params) {
  const subject = "【新規予約】高校生キャリアコーチング保護者説明会";
  const body = `以下の内容で予約が確定しました。

氏名：${params.name}
メール：${params.email}
電話番号：${params.tel}
連絡方法：${params.contactMethod === CONTACT_METHODS.PHONE ? "電話" : "Google Meet"}
日時：${formatSlotLabel(params.start, params.end)}
担当候補：${params.staffAlias || "DEFAULT"} (${params.staffEmail})
Google Meet：${params.meetLink || "-"}

※このメールはシステムより自動送信されています。`;

  GmailApp.sendEmail("litable.official@gmail.com", subject, body);
}

function sendSorryMail(name, email) {
  const subject = "【日程調整のお願い】無料体験について";
  const body = `${name} 様

無料体験のお申し込みありがとうございます。
申し訳ございませんが、ご希望の時間が他の方の予約と重なってしまいました。

お手数ですが、他の候補日時を2〜3つご返信いただけますでしょうか。
担当より折り返しご連絡いたします。

よろしくお願いいたします。
`;

  GmailApp.sendEmail(email, subject, body);
}

function logReservation(params) {
  const ss = SpreadsheetApp.openById(RESP_SHEET_ID);
  let sheet = ss.getSheetByName("reservations");
  if (!sheet) {
    sheet = ss.insertSheet("reservations");
    sheet.appendRow([
      "timestamp",
      "name",
      "email",
      "tel",
      "contactMethod",
      "startISO",
      "endISO",
      "meetLink",
      "status",
      "notes",
    ]);
  }

  sheet.appendRow([
    new Date(),
    params.name,
    params.email,
    params.tel,
    params.contactMethod,
    params.startISO,
    params.endISO,
    params.meetLink,
    params.status,
    params.notes,
  ]);
}

function handleBooking(data) {
  const name = (data.name || "").trim();
  const email = (data.email || "").trim();
  const tel = (data.tel || "").trim();
  const slotISO = (data.slotISO || "").trim();
  const rawContactMethod = (data.contactMethod || "").toLowerCase();
  const contactMethod = rawContactMethod === CONTACT_METHODS.PHONE ? CONTACT_METHODS.PHONE : CONTACT_METHODS.MEET;

  if (!name || !email || !tel || !slotISO) {
    return {
      status: "error",
      message: "必須項目が未入力です。",
    };
  }

  const start = new Date(slotISO);
  if (isNaN(start.getTime())) {
    return {
      status: "error",
      message: "日時の形式が不正です。",
    };
  }

  const end = new Date(start.getTime() + MEETING_LENGTH_MIN * 60 * 1000);

  try {
    const allSlots = getCandidateSlots(true);
    const slotObj = allSlots.find((slot) => slot.startISO === start.toISOString());

    if (!slotObj) {
      sendSorryMail(name, email);
    logReservation({
      name,
      email,
      tel,
      contactMethod,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: "",
      status: "failed",
      notes: "slot_no_longer_available",
      });
      return {
        status: "error",
        reason: "slot_taken",
        message: "大変申し訳ありません、その時間は埋まりました。別の時間をお選びください。",
      };
    }

    if (!isSlotStillFreeForBooking(start, end)) {
      sendSorryMail(name, email);
    logReservation({
      name,
      email,
      tel,
      contactMethod,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: "",
      status: "failed",
      notes: "slot_conflict",
      });
      return {
        status: "error",
        reason: "slot_taken",
        message: "大変申し訳ありません、その時間は埋まりました。別の時間をお選びください。",
      };
    }

    const assigned = chooseStaff(slotObj.staffAliases);

    const bookedInfo = createBookedEventWithStaff({
      start,
      end,
      name,
      email,
      tel,
      staffEmail: assigned.email,
      contactMethod,
    });

    sendConfirmMail(name, email, start, end, bookedInfo.meetLink, contactMethod);
    sendInternalNotification({
      name,
      email,
      tel,
      start,
      end,
      contactMethod,
      staffAlias: assigned.alias,
      staffEmail: assigned.email,
      meetLink: bookedInfo.meetLink,
    });

    logReservation({
      name,
      email,
      tel,
      contactMethod,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: bookedInfo.meetLink,
      status: "booked",
      notes: `staff=${assigned.alias}|${assigned.email}|contact=${contactMethod}`,
    });

    return {
      status: "ok",
      message: "予約が確定しました。メールをご確認ください。",
    };
  } catch (err) {
    console.error("handleBooking error", err);
    logReservation({
      name,
      email,
      tel,
      contactMethod,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      meetLink: "",
      status: "failed",
      notes: "internal_error",
    });
    return {
      status: "error",
      message: "処理中にエラーが発生しました。時間を置いて再度お試しください。",
    };
  }
}

function doOptions(e) {
  var origin =
    (e && e.headers && (e.headers.Origin || e.headers.origin)) ||
    (e && e.parameter && e.parameter.origin) ||
    "";
  return withCors("", {
    origin: origin,
    statusCode: 204,
    contentType: TEXT_CONTENT_TYPE,
  });
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const mode = (params.mode || "").toLowerCase();
    const origin =
      (e && e.headers && (e.headers.Origin || e.headers.origin)) ||
      params.origin ||
      "";

    if (mode === "slots") {
      const slots = getCandidateSlots(false);
      return jsonResponse(slots, origin);
    }

    return jsonResponse({ status: "ok", message: "alive" }, origin);
  } catch (err) {
    console.error("doGet error", err);
    const origin =
      (e && e.headers && (e.headers.Origin || e.headers.origin)) || "";
    return jsonResponse({ status: "error", message: "internal error" }, origin);
  }
}

function doPost(e) {
  try {
    const params = (e && e.parameter) || {};
    const mode = (params.mode || "").toLowerCase();
    const origin =
      (e && e.headers && (e.headers.Origin || e.headers.origin)) ||
      (e && e.postData && e.postData.type && e.parameter && e.parameter.origin) ||
      "";

    if (mode === "book") {
      let payload = {};
      if (e && e.postData && e.postData.contents) {
        const postType = String(e.postData.type || "").toLowerCase();
        if (postType.indexOf("application/json") === 0) {
          try {
            payload = JSON.parse(e.postData.contents);
          } catch (parseErr) {
            console.error("JSON parse error", parseErr);
            return jsonResponse(
              {
                status: "error",
                message: "リクエスト形式が不正です。",
              },
              origin,
            );
          }
        } else if (postType.indexOf("application/x-www-form-urlencoded") === 0) {
          payload = Object.assign({}, params);
        }
      }

      if (!payload || Object.keys(payload).length === 0) {
        payload = Object.assign({}, params);
      }

      const result = handleBooking(payload);
      return jsonResponse(result, origin);
    }

    return jsonResponse({ status: "error", message: "unknown mode" }, origin);
  } catch (err) {
    console.error("doPost error", err);
    const origin =
      (e && e.headers && (e.headers.Origin || e.headers.origin)) || "";
    return jsonResponse({ status: "error", message: "internal error" }, origin);
  }
}
