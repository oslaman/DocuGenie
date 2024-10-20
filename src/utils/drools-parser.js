import fs from 'fs';

function parseDRL(drlContent) {
    const rules = [];
    const ruleRegex = /rule\s+"([^"]+)"\s+when\s+([^]+?)\s+then\s+([^]+?)\s+end/g;
    let match;

    while ((match = ruleRegex.exec(drlContent)) !== null) {
        const [, ruleName, conditions, actions] = match;
        rules.push({ ruleName, conditions, actions });
    }

    return rules;
}

function evaluateConditions(conditions, facts) {
    return conditions.split('\n').every(condition => {
        return eval(condition.replace(/(\w+)\s*==\s*(\w+)/, (match, p1, p2) => `${facts[p1]} === ${p2}`));
    });
}

function executeActions(actions, context) {
    actions.split('\n').forEach(action => {
        const actionFunction = new Function('context', `
            with (context) {
                ${action}
            }
        `);
        actionFunction(context);
    });
}

function sendEmail(to, subject) {
    console.log(`Sending email to ${to} with subject: ${subject}`);
}

function logToDatabase(message) {
    console.log(`Logging to database: ${message}`);
}

const drlFilePath = "../assets/rules.drl";
fs.readFile(drlFilePath, 'utf8', (err, drlContent) => {
    if (err) {
        console.error('Error reading DRL file:', err);
        return;
    }

    const rules = parseDRL(drlContent);
    const facts = { userActive: false };

    rules.forEach(rule => {
        if (evaluateConditions(rule.conditions, facts)) {
            executeActions(rule.actions, { sendEmail, logToDatabase });
        }
    });
});
