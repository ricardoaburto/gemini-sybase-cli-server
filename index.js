#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import process from 'process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verificar que las variables necesarias estén presentes
const requiredEnvVars = [
    'SYBASE_HOST',
    'SYBASE_PORT',
    'SYBASE_DATABASE',
    'SYBASE_USERNAME',
    'SYBASE_PASSWORD'
];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`Error: La variable de entorno ${varName} no está definida.`);
        process.exit(1);
    }
}

// Ejecutar la consulta usando el cliente Java
async function runSybaseQuery(sql) {
    return new Promise((resolve, reject) => {
        const {
            SYBASE_HOST: host,
            SYBASE_PORT: port,
            SYBASE_DATABASE: database,
            SYBASE_USERNAME: username,
            SYBASE_PASSWORD: password
        } = process.env;

        const execDir = path.resolve(__dirname);
        const args = [
            '-cp',
            '.;jtds-1.3.1.jar;json-20231013.jar', // json-20231013.jar se mantiene para el classpath de Java, aunque ya no se use org.json
            'SybaseQuery',
            host,
            port,
            database,
            username,
            password,
            Buffer.from(sql).toString('base64') // Codificar la consulta SQL en Base64
        ];

        console.error(`Comando ejecutado: java ${args.join(' ')}`);

        const child = spawn('java', args, { cwd: execDir });
        console.error(`DEBUG: Spawning command: java ${args.join(' ')}`);

        child.on('error', (err) => {
            console.error(`Failed to start Java process: ${err.message}`);
            reject(new Error(`Failed to start Java process: ${err.message}`));
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', data => {
            stdout += data.toString();
        });

        child.stderr.on('data', data => {
            stderr += data.toString();
        });

        child.on('close', code => {
            if (code === 0) {
                console.error(`DEBUG: Raw stdout from Java: \n---START RAW---\n${stdout}\n---END RAW---`);
                // Parsear la salida delimitada por tabulaciones a JSON
                const lines = stdout.trim().split(/\r?\n/);
                console.error(`DEBUG: Parsed lines: ${JSON.stringify(lines)}`);
                if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
                    resolve('[]'); // Devolver un array JSON vacío si no hay resultados
                    return;
                }
                const headers = lines[0].split('\t');
                console.error(`DEBUG: Parsed headers: ${JSON.stringify(headers)}`);
                const results = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line === '') continue; // Saltar líneas vacías
                    const values = line.split('\t');
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    results.push(row);
                }
                console.error(`DEBUG: Final parsed results: ${JSON.stringify(results)}`);
                resolve(JSON.stringify(results));
            } else {
                reject(new Error(stderr.trim() || 'Error desconocido al ejecutar el proceso Java.'));
            }
        });
    });
}



export const executeQueryHandler = async ({ sql }) => {
    try {
        // Validación básica: permitir solo SELECT
        const sanitizedSql = sql.trim().toLowerCase();

        // Asegurar que comience con SELECT y que no contenga palabras peligrosas
        if (!sanitizedSql.startsWith('select')) {
            throw new Error('Solo se permiten consultas SELECT.');
        }

        // Opcional: prevenir múltiples sentencias o palabras peligrosas
        const forbiddenKeywords = ['insert', 'update', 'delete', 'drop', 'alter', ';'];
        for (const keyword of forbiddenKeywords) {
            if (sanitizedSql.includes(keyword)) {
                throw new Error(`La consulta contiene una palabra prohibida: ${keyword}`);
            }
        }

        console.error(':::: getTableDefinition - sql: ' + sql);
        const output = await runSybaseQuery(sql);
        return {
            content: [{ type: 'text', text: output }]
        };
    } catch (err) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
        };
    }
};

export const getTableDefinitionHandler = async ({ tableName }) => {
    try {
        // Validar que el nombre de la tabla sea alfanumérico para prevenir inyección SQL
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw new Error('El nombre de la tabla contiene caracteres no válidos.');
        }

        const query = `
        SELECT 
            c.name AS column_name, 
            t.name AS data_type, 
            c.length 
        FROM syscolumns c
        JOIN systypes t ON c.usertype = t.usertype
        JOIN sysobjects o ON c.id = o.id
        WHERE o.name = '${tableName}' AND o.type = 'U'`;

        console.error(':::: getTableDefinition - query: ' + query);
        const output = await runSybaseQuery(query);

        return {
            content: [{ type: 'text', text: output }]
        };
    } catch (err) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
        };
    }
};

export const listTablesBySchemaHandler = async () => {
    console.error('DEBUG: listTablesBySchema tool invoked.');
    try {
        // Consulta mejorada para mayor eficiencia y legibilidad
        const query = `
            SELECT 
                u.name as owner, 
                o.name as table_name 
            FROM sysobjects o 
            JOIN sysusers u ON o.uid = u.uid 
            WHERE o.type = 'U' 
            ORDER BY owner, table_name`;

        console.error(':::: listTablesBySchema - query: ' + query);
        const output = await runSybaseQuery(query);

        return {
            content: [{ type: 'text', text: output }]
        };
    } catch (err) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
        };
    }
};



export const getDatabaseSchemaHandler = async () => {
    try {
        const query = `
            SELECT 
                o.name AS object_name,
                o.type AS object_type,
                u.name AS owner_name,
                c.name AS column_name,
                t.name AS data_type,
                c.length AS column_length,
                c.prec AS precision,
                c.scale AS scale,
                c.status AS column_status
            FROM sysobjects o
            JOIN sysusers u ON o.uid = u.uid
            LEFT JOIN syscolumns c ON o.id = c.id
            LEFT JOIN systypes t ON c.usertype = t.usertype
            WHERE o.type IN ('U', 'V', 'P') -- User tables, Views, Stored Procedures
            ORDER BY object_type, object_name, column_name
        `;

        console.error(':::: getDatabaseSchema - query: ' + query);
        const output = await runSybaseQuery(query);

        return {
            content: [{ type: 'text', text: output }]
        };
    } catch (err) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
        };
    }
};

export const executeStoredProcedureHandler = async ({ procedureName, params = [] }) => {
    try {
        // Construir la sentencia EXEC
        let query = `EXEC ${procedureName}`;
        if (params.length > 0) {
            // Asegurarse de que los parámetros se escapen correctamente para SQL
            const escapedParams = params.map(p => {
                // Si el parámetro es un número, no lo encerramos en comillas
                if (!isNaN(p) && !isNaN(parseFloat(p))) {
                    return p;
                } else {
                    // Para strings, escapar comillas simples y encerrar en comillas simples
                    const escapedString = p.replace(/'/g, "''");
                    return `'${escapedString}'`;
                }
            });
            query += ` ${escapedParams.join(', ')}`;
        }

        console.error(`:::: executeStoredProcedure - query: ${query}`);
        const output = await runSybaseQuery(query);

        return {
            content: [{ type: 'text', text: output }]
        };
    } catch (err) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${err.message}` }]
        };
    }
};

// Inicializar el servidor MCP
export async function main() {
    const server = new McpServer({
        name: 'gemini-sybase-cli-server',
        version: '1.0.0',
    });

    // Registrar la herramienta
    server.tool(
        'executeQuery',
        'Ejecuta una consulta SQL en Sybase',
        {
            sql: z.string().describe('Consulta SQL a ejecutar')
        },
        executeQueryHandler
    );


    server.tool(
        'getTableDefinition',
        'Obtiene la definición de columnas de una tabla en Sybase',
        {
            tableName: z.string().describe('Nombre de la tabla')
        },
        getTableDefinitionHandler
    );



    server.tool(
        'listTablesBySchema',
        'Obtiene la lista de esquemas y tablas de usuario en Sybase',
        listTablesBySchemaHandler
    );

    

    server.tool(
        'getDatabaseSchema',
        'Obtiene el esquema completo de la base de datos (tablas, vistas, procedimientos)',
        getDatabaseSchemaHandler
    );

    server.tool(
        'executeStoredProcedure',
        'Ejecuta un procedimiento almacenado en Sybase',
        {
            procedureName: z.string().describe('Nombre del procedimiento almacenado'),
            params: z.array(z.string()).optional().describe('Parámetros del procedimiento (opcional)')
        },
        executeStoredProcedureHandler
    );


    // Conectar a través de stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Gemini Sybase MCP server running on stdio');
    return server; // Devolver la instancia del servidor
}

main().catch(err => {
    console.error('Error al iniciar el servidor MCP:', err);
    process.exit(1);
});
