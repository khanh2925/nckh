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
