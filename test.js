import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    executeQueryHandler,
    getTableDefinitionHandler,
    listTablesBySchemaHandler,
    getDatabaseSchemaHandler,
    executeStoredProcedureHandler
} from './index.js';

const saveTestArtifacts = (results) => {
    const folderPath = path.resolve('./resultado');
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // Archivos individuales
    results.forEach(result => {
        const safeFileName = `${result.identifier.replace(/\s+/g, '_').replace(/[^\w]/g, '')}.json`;
        const filePath = path.join(folderPath, safeFileName);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
        result.filePath = filePath;
    });

    // Consolidado
    const allJsonPath = path.join(folderPath, 'todos-los-tests.json');
    fs.writeFileSync(allJsonPath, JSON.stringify(results, null, 2), 'utf-8');

    // Markdown
    const markdownReport = results.map((result, i) => {
        return `### ${i + 1}. ${result.name}

- **Resultado**: ${result.status === 'PASSED' ? '✅ Éxito' : '❌ Falló'}
- 🕓 **Timestamp**: ${result.timestamp}
- 📄 **Archivo JSON**: \`${path.basename(result.filePath)}\`
${result.errorMessage ? `\n**Mensaje de error:**\n\`\`\`\n${result.errorMessage}\n\`\`\`\n` : ''}
`;
    }).join('\n');

    const reportPath = path.join(folderPath, 'reporte-test.md');
    fs.writeFileSync(reportPath, `# 🧪 Reporte de Pruebas\n\n${markdownReport}`, 'utf-8');

    console.log(`\n✅ Archivos generados:\n- ${allJsonPath}\n- ${reportPath}`);
};

async function runTests() {
    console.log('--- Starting Direct Test Runner ---');

    const testResults = [];

    const runSingleTest = async (name, testFunction, identifier, inputData = {}) => {
        let status = 'PASSED';
        let errorMessage = '';
        let rawOutput = null;
        const timestamp = new Date().toISOString();

        try {
            rawOutput = await testFunction();
        } catch (error) {
            status = 'FAILED';
            errorMessage = error.message;
            console.error(`--- Test FAILED: ${name} ---`);
            console.error(error);
            process.exitCode = 1;
        }

        testResults.push({
            name,
            identifier,
            status,
            timestamp,
            input: inputData,
            ...(errorMessage ? { errorMessage } : {}),
            output: rawOutput || null
        });

        console.log(`[${testResults.length}/6] ${status}`);
    };

    try {
        await runSingleTest(
            'listTablesBySchema (success)',
            async () => {
                const res = await listTablesBySchemaHandler();
                assert.strictEqual(res.isError, undefined);
                const content = JSON.parse(res.content[0].text);
                assert.ok(Array.isArray(content));
                return res;
            },
            'listTablesBySchema',
            {}
        );

        await runSingleTest(
            'getTableDefinition (success)',
            async () => {
                const tableName = 'sysobjects';
                const res = await getTableDefinitionHandler({ tableName });
                assert.strictEqual(res.isError, undefined);
                const content = JSON.parse(res.content[0].text);
                assert.ok(Array.isArray(content));
                return res;
            },
            'getTableDefinition',
            { tableName: 'sysobjects' }
        );

        await runSingleTest(
            'getTableDefinition (SQL injection attempt)',
            async () => {
                const tableName = 'sysobjects; --';
                const res = await getTableDefinitionHandler({ tableName });
                assert.strictEqual(res.isError, true);
                assert.ok(res.content[0].text.includes('caracteres no válidos'));
                return res;
            },
            'getTableDefinition_SQLInjection',
            { tableName: 'sysobjects; --' }
        );

        await runSingleTest(
            'executeQuery (simple select)',
            async () => {
                const sql = 'SELECT 1 as test_col';
                const res = await executeQueryHandler({ sql });
                assert.strictEqual(res.isError, undefined);
                const content = JSON.parse(res.content[0].text);
                assert.ok(Array.isArray(content));
                assert.strictEqual(content[0].test_col, '1');
                return res;
            },
            'executeQuery',
            { sql: 'SELECT 1 as test_col' }
        );

        await runSingleTest(
            'getDatabaseSchema (success)',
            async () => {
                const res = await getDatabaseSchemaHandler();
                assert.strictEqual(res.isError, undefined);
                const content = JSON.parse(res.content[0].text);
                assert.ok(Array.isArray(content));
                assert.ok(content.length > 0);
                return res;
            },
            'getDatabaseSchema',
            {}
        );

        await runSingleTest(
            'executeStoredProcedure (success)',
            async () => {
                const procedureName = 'sp_who';
                const res = await executeStoredProcedureHandler({ procedureName });
                assert.strictEqual(res.isError, undefined);
                return res;
            },
            'executeStoredProcedure',
            { procedureName: 'sp_who' }
        );

    } catch (error) {
        console.error('\n--- Test Runner Failed Unexpectedly ---');
        console.error(error);
        process.exitCode = 1;
    } finally {
        console.log('\n--- Tests finished. ---');
        saveTestArtifacts(testResults);
    }
}

runTests();
