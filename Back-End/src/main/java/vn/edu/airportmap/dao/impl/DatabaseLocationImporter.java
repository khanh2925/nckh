package vn.edu.airportmap.dao.impl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.airportmap.model.Location;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
@Component
@Profile("postgres")
public class DatabaseLocationImporter implements ApplicationRunner {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate transaction;
 private final LocationPostgresDao dao;
 private final ObjectMapper mapper;
 private final Path file;
 private final boolean enabled;
 public DatabaseLocationImporter(JdbcTemplate jdbc,TransactionTemplate transaction,LocationPostgresDao dao,ObjectMapper mapper,
  @Value("${app.data-file}") String file,@Value("${app.database.import-json:true}") boolean enabled) {
  this.jdbc=jdbc;this.transaction=transaction;this.dao=dao;this.mapper=mapper;this.file=Path.of(file);this.enabled=enabled;
 }
 @Override public void run(ApplicationArguments args) {
  if(!enabled)return;
  transaction.executeWithoutResult(status -> {
   // Prevent concurrent imports and CRUD while initial data is imported.
   jdbc.execute("LOCK TABLE locations, data_imports IN EXCLUSIVE MODE");
   if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM data_imports WHERE name = 'locations-json-v1')",Boolean.class)))return;
   if(jdbc.queryForObject("SELECT count(*) FROM locations",Long.class)!=0)
    throw new IllegalStateException("Existing locations without import marker: set DB_IMPORT_JSON=false to use them");
   List<Location> locations;
   try { locations=mapper.readValue(file.toFile(),new TypeReference<List<Location>>(){}); }
   catch(java.io.IOException e){throw new IllegalStateException("Cannot read import file "+file.toAbsolutePath(),e);}
   if(locations.isEmpty())throw new IllegalStateException("Import file is empty");
   var ids=new HashSet<Long>();long maximum=0;
   for(Location l:locations) {
    if(l.getId()==null||l.getId()<=0||!ids.add(l.getId()))throw new IllegalStateException("Import requires unique positive IDs");
    maximum=Math.max(maximum,l.getId());dao.importLocation(l);
   }
   // Sequence restart is transactional, unlike setval.
   jdbc.execute("ALTER SEQUENCE location_id_seq RESTART WITH "+Math.addExact(maximum,1));
   jdbc.update("INSERT INTO data_imports (name) VALUES ('locations-json-v1')");
  });
 }
}
