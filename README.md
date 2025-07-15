
# Gemini Sybase CLI

Una herramienta de línea de comandos para ejecutar consultas SQL en una base de datos Sybase, utilizando un DSN de ODBC de Windows.

Esta herramienta está diseñada para ser utilizada en entornos donde la conexión a la base de datos está pre-configurada a través de un DSN de ODBC.

## Requisitos

- Node.js y npm
- PowerShell (incluido en Windows)
- Un DSN de ODBC configurado en Windows.

## Instalación

Para usar esta herramienta, puedes instalarla globalmente a través de `npm` o ejecutarla directamente con `npx`.

**Opción A: Instalación Global**

```bash
npm install -g .
```
(Debes estar en el directorio del proyecto, `gemini-sybase-cli-server`, para que esto funcione).

Una vez instalado globalmente, puedes llamar a la herramienta desde cualquier lugar.

**Opción B: Ejecución con NPX**

No se necesita instalación. `npx` descargará y ejecutará el paquete temporalmente.

```bash
npx .
```

## Uso

La herramienta requiere dos cosas para funcionar:

1.  Una **variable de entorno `DB_CONNECTION_STRING`** que contenga tu cadena de conexión de ODBC.
2.  La **consulta SQL** que deseas ejecutar, pasada como un argumento de línea de comandos (entre comillas).

### Sintaxis

```bash
DB_CONNECTION_STRING="tu_cadena_de_conexion" gemini-sybase-cli-server "TU CONSULTA SQL"
```

### Ejemplo de Uso (Windows)

En la terminal de Windows (`cmd`), puedes definir la variable de entorno y ejecutar el comando de la siguiente manera:

```bash
set DB_CONNECTION_STRING="DSN=test;uid=sa;pwd="
gemini-sybase-cli-server "SELECT @@version"
```

O en una sola línea:

```bash
set DB_CONNECTION_STRING="DSN=test;uid=sa;pwd="&&gemini-sybase-cli-server "SELECT top 5 name, type FROM sysobjects"
```

En PowerShell:

```powershell
$env:DB_CONNECTION_STRING="DSN=test;uid=sa;pwd="; gemini-sybase-cli-server "SELECT @@version"
```

### Salida Exitosa

La salida será un string JSON en una sola línea con el resultado de la consulta.

```json
[{"name":"sysusers","type":"S"},{"name":"sysxtypes","type":"S"},{"name":"syssegments","type":"S"},{"name":"sysalternates","type":"S"},{"name":"sysprocedures","type":"S"}]
```

### Salida de Error

Si ocurre un error, el mensaje se imprimirá en la consola de error (`stderr`).
