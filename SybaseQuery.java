import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.ResultSetMetaData;
import java.util.Scanner;

public class SybaseQuery {
    public static void main(String[] args) {
        if (args.length < 5) {
            System.err.println("Usage: java SybaseQuery <host> <port> <database> <username> <password>");
            System.exit(1);
        }

        String host = args[0];
        String port = args[1];
        String database = args[2];
        String username = args[3];
        String password = args[4];

        // Leer la consulta desde stdin
        Scanner scanner = new Scanner(System.in);
        StringBuilder queryBuilder = new StringBuilder();
        while (scanner.hasNextLine()) {
            queryBuilder.append(scanner.nextLine());
        }
        String query = queryBuilder.toString();
        scanner.close();

        String dbUrl = "jdbc:jtds:sybase://" + host + ":" + port + "/" + database;

        try {
            Class.forName("net.sourceforge.jtds.jdbc.Driver");
            Connection connection = DriverManager.getConnection(dbUrl, username, password);
            Statement statement = connection.createStatement();
            ResultSet resultSet = statement.executeQuery(query);

            // Imprimir resultados como texto plano
            ResultSetMetaData metaData = resultSet.getMetaData();
            int columnCount = metaData.getColumnCount();

            while (resultSet.next()) {
                for (int i = 1; i <= columnCount; i++) {
                    System.out.print(resultSet.getString(i) + (i == columnCount ? "" : ","));
                }
                System.out.println();
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