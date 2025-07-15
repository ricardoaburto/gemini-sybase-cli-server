import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.ResultSetMetaData;


import java.util.Base64;

public class SybaseQuery {
    public static void main(String[] args) {
        if (args.length < 6) {
            System.err.println("Usage: java SybaseQuery <host> <port> <database> <username> <password> <query>");
            System.exit(1);
        }

        String host = args[0];
        String port = args[1];
        String database = args[2];
        String username = args[3];
        String password = args[4];
        String encodedQuery = args[5];
        String query = new String(Base64.getDecoder().decode(encodedQuery));

        String dbUrl = "jdbc:jtds:sybase://" + host + ":" + port + "/" + database;

        try {
            System.err.println("DEBUG: Intentando cargar el driver JDBC...");
            Class.forName("net.sourceforge.jtds.jdbc.Driver");
            System.err.println("DEBUG: Driver cargado. Intentando conectar a la base de datos...");
            Connection connection = DriverManager.getConnection(dbUrl, username, password);
            System.err.println("DEBUG: Conexión exitosa. Ejecutando consulta...");
            Statement statement = connection.createStatement();
            ResultSet resultSet = statement.executeQuery(query);
            System.err.println("DEBUG: Consulta ejecutada. Procesando resultados...");

            ResultSetMetaData metaData = resultSet.getMetaData();
            int columnCount = metaData.getColumnCount();

            // Imprimir nombres de columna
            for (int i = 1; i <= columnCount; i++) {
                System.out.print(metaData.getColumnName(i));
                if (i < columnCount) {
                    System.out.print("\t"); // Separador de tabulación
                }
            }
            System.out.println(); // Nueva línea después de los encabezados

            // Imprimir datos de las filas
            while (resultSet.next()) {
                for (int i = 1; i <= columnCount; i++) {
                    System.out.print(resultSet.getString(i));
                    if (i < columnCount) {
                        System.out.print("\t"); // Separador de tabulación
                    }
                }
                System.out.println(); // Nueva línea después de cada fila
            }

            resultSet.close();
            statement.close();
            connection.close();
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
        }
    }
}