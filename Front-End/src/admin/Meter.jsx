// Share of locations directions can reach, as a bar + percent. Colour says how urgent it is.
function Meter({ value, total }) {
    const percent = total === 0 ? 100 : Math.floor(value / total * 100);
    const level = percent === 100 ? "ok" : percent >= 80 ? "warn" : "bad";
    return (
        <span className={`meter is-${level}`}>
            <span className="meter-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
            <span className="meter-text">{percent}%</span>
        </span>
    );
}

export default Meter;
