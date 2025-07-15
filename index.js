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
        const command = 'java';
        const args = ['-cp', '.;jtds-1.3.1.jar', 'SybaseQuery', host, port, database, username, password];

        console.error(`Comando ejecutado: ${command} ${args.join(' ')}`);

        const child = spawn(command, args, { cwd: execDir });

        // Enviar la consulta a través de stdin
        child.stdin.write(sql);
        child.stdin.end();

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
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr.trim() || 'Error desconocido al ejecutar el proceso Java.'));
            }
        });
    });
}

// Inicializar el servidor MCP
async function main() {
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
        async ({ sql }) => {
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
    
                console.log(':::: getTableDefinition - sql: ' + sql);
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
        }
    );


    server.tool(
        'getTableDefinition',
        'Obtiene la definición de columnas de una tabla en Sybase',
        {
            tableName: z.string().describe('Nombre de la tabla')
        },
        async ({ tableName }) => {
            try {
                const query = `
                SELECT 
                    c.name AS column_name, 
                    t.name AS data_type, 
                    c.length 
                FROM syscolumns c
                JOIN systypes t ON c.usertype = t.usertype
                JOIN sysobjects o ON c.id = o.id
                WHERE o.name = '${tableName}' AND o.type = 'U'`;

                console.log(':::: getTableDefinition - query: ' + query);
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
        }
    );

    server.tool(
        'listTablesBySchema',
        'Obtiene la lista de esquemas y tablas de usuario en Sybase',
        async () => {
            try {
                const query = `SELECT * FROM sysobjects o JOIN sysusers u ON o.uid = u.uid WHERE o.type = 'U'`;

                console.log(':::: getTableDefinition - query: ' + query);
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
        }
    );


    // Conectar a través de stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Gemini Sybase MCP server running on stdio');
}

main().catch(err => {
    console.error('Error al iniciar el servidor MCP:', err);
    process.exit(1);
});
