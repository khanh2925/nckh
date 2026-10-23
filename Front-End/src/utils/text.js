// Lowercase + remove Vietnamese accents, so "cua 09" still finds "Cửa 09".
// "NFD" splits "ử" into "u" + accent marks, then the regex removes the accent marks.
export function normalizeText(text) {
    return (text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

// Short floor name for messages: 0 -> "Tầng trệt", 2 -> "Tầng 2"
export function floorLabel(floor) {
    return floor === 0 ? "Tầng trệt" : `Tầng ${floor}`;
}

// The crawled data writes opening hours in English: "24 Hours", "5AM-9PM", "6AM - 11:45PM"
export function translateHours(text) {
    if (/^24\s*hours?$/i.test(text.trim())) return "Mở cửa 24 giờ";
    return text
        .replace(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi, (match, hour, minute = "00", half) => {
            const value = (Number(hour) % 12) + (half.toUpperCase() === "PM" ? 12 : 0);
            return `${String(value).padStart(2, "0")}:${minute}`;
        })
        .replace(/\s*-\s*/g, " – ");
}
