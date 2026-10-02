package vn.edu.airportmap.dao.impl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.model.Location;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
@Repository
@Profile("postgres")
@Transactional
public class LocationPostgresDao implements LocationDao {
 private static final String SELECT = """
  SELECT l.*, t.code AS terminal, f.level AS floor, lt.code AS type,
    CASE WHEN l.facilities_known THEN COALESCE(
      (SELECT jsonb_agg(fc.name ORDER BY lf.position)::text
       FROM location_facilities lf JOIN facilities fc ON fc.id = lf.facility_id
       WHERE lf.location_id = l.id), '[]') ELSE NULL END AS facilities
  FROM locations l JOIN floors f ON f.id = l.floor_id
  JOIN terminals t ON t.code = f.terminal_code
  LEFT JOIN location_types lt ON lt.code = l.type_code
  """;
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 public LocationPostgresDao(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc=jdbc; this.mapper=mapper; }
 @Override @Transactional(readOnly=true)
 public List<Location> findAll() { return jdbc.query(SELECT + " ORDER BY l.id", this::read); }
 @Override @Transactional(readOnly=true)
 public Location findById(Long id) {
  var rows=jdbc.query(SELECT + " WHERE l.id = ?",this::read,id);
  return rows.isEmpty()?null:rows.get(0);
 }
 @Override public Location save(Location l) {
  write(l, false);
  return l;
 }

 // Importer supplies original IDs inside a single transaction.
 void importLocation(Location l) { write(l, true); }

 private void write(Location l, boolean importing) {
  if (l.getTerminal() == null || l.getTerminal().isBlank() || l.getFloor() == null)
   throw new IllegalArgumentException("Terminal and floor are required");
  // Existing API allows new catalog values. Register them atomically before referencing them.
  jdbc.update("INSERT INTO terminals(code,name) VALUES (?,?) ON CONFLICT DO NOTHING", l.getTerminal(), l.getTerminal());
  jdbc.update("INSERT INTO floors(terminal_code,level,name) VALUES (?,?,?) ON CONFLICT DO NOTHING",
    l.getTerminal(), l.getFloor(), l.getFloor() == 0 ? "Tầng trệt" : "Tầng " + l.getFloor());
  Long floorId = jdbc.queryForObject("SELECT id FROM floors WHERE terminal_code = ? AND level = ?", Long.class, l.getTerminal(), l.getFloor());
  if (l.getType() != null)
   jdbc.update("INSERT INTO location_types(code,name) VALUES (?,?) ON CONFLICT DO NOTHING", l.getType(), l.getType());
  Object[] values = {l.getName(), l.getType(), floorId, l.getX(), l.getY(), l.getLat(), l.getLng(),
    l.getSourceId(), l.getPhone(), l.getWebsite(), l.getArea(), l.getDescription(), l.getOpeningHours(), l.getFacilities() != null};
  String columns = "name,type_code,floor_id,x,y,lat,lng,source_id,phone,website,area,description,opening_hours,facilities_known";
  String marks = "?,?,?,?,?,?,?,?,?,?,?,?,?,?";
  if (importing) {
   jdbc.update("INSERT INTO locations (" + columns + ",id) VALUES (" + marks + ",?)", append(values,l.getId()));
  } else if (l.getId() == null) {
   l.setId(jdbc.queryForObject("INSERT INTO locations (" + columns + ") VALUES (" + marks + ") RETURNING id",Long.class,values));
  } else {
   int updated = jdbc.update("UPDATE locations SET name=?,type_code=?,floor_id=?,x=?,y=?,lat=?,lng=?,source_id=?,phone=?,website=?,area=?,description=?,opening_hours=?,facilities_known=? WHERE id=?",append(values,l.getId()));
   if (updated == 0) throw new IllegalStateException("Location was deleted: " + l.getId());
  }
  jdbc.update("DELETE FROM location_facilities WHERE location_id = ?", l.getId());
  if (l.getFacilities() != null) {
   int position = 0;
   for (String name : l.getFacilities()) {
    if (name == null || name.isBlank()) throw new IllegalArgumentException("Facility name must not be blank");
    jdbc.update("INSERT INTO facilities(name) VALUES (?) ON CONFLICT DO NOTHING",name);
    Long facilityId = jdbc.queryForObject("SELECT id FROM facilities WHERE name = ?",Long.class,name);
    jdbc.update("INSERT INTO location_facilities(location_id,facility_id,position) VALUES (?,?,?)",l.getId(),facilityId,position++);
   }
  }
 }

 private Object[] append(Object[] values, Long id) {
  Object[] result = java.util.Arrays.copyOf(values, values.length + 1);
  result[values.length] = id;
  return result;
 }
 @Override public boolean deleteById(Long id) {return jdbc.update("DELETE FROM locations WHERE id = ?",id)>0;}
 private Location read(ResultSet rs,int row) throws SQLException {
  Location l=new Location(); l.setId(rs.getLong("id"));
  l.setName(rs.getObject("name", String.class));
l.setType(rs.getObject("type", String.class));
l.setTerminal(rs.getObject("terminal", String.class));
l.setFloor(rs.getObject("floor", Integer.class));
l.setX(rs.getObject("x", Double.class));
l.setY(rs.getObject("y", Double.class));
l.setLat(rs.getObject("lat", Double.class));
l.setLng(rs.getObject("lng", Double.class));
l.setSourceId(rs.getObject("source_id", Long.class));
l.setPhone(rs.getObject("phone", String.class));
l.setWebsite(rs.getObject("website", String.class));
l.setArea(rs.getObject("area", String.class));
l.setDescription(rs.getObject("description", String.class));
l.setOpeningHours(rs.getObject("opening_hours", String.class));
l.setFacilities(decode(rs.getString("facilities")));
  return l;
 }
 private List<String> decode(String value) {
  if(value==null)return null;
  try{return mapper.readValue(value,new TypeReference<List<String>>(){});}catch(java.io.IOException e){throw new IllegalStateException("Invalid facilities",e);}
 }
}
