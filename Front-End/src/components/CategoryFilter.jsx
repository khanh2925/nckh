import { typeGroups } from "../data/locationTypes";

function CategoryFilter({ activeGroup, onChange }) {
    return (
        <div className="category-filter" role="toolbar" aria-label="Lọc theo loại địa điểm">
            {typeGroups.map(group => {
                const isActive = activeGroup === group.id;
                return (
                    <button
                        type="button"
                        key={group.id}
                        className={`btn btn-sm rounded-pill ${isActive ? "btn-dark" : "btn-light border"}`}
                        aria-pressed={isActive}
                        onClick={() => onChange(group.id)}
                    >
                        <i className={`bi ${group.icon} me-1`} style={isActive ? undefined : { color: group.color }} />
                        {group.label}
                    </button>
                );
            })}
        </div>
    );
}

export default CategoryFilter;
