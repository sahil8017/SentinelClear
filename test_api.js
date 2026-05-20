const crypto = require('crypto');

const BASE_URL = 'http://localhost:8000';
const uid = crypto.randomBytes(4).toString('hex');

async function main() {
    try {
        console.log("Registering test user...");
        await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `test_${uid}`,
                email: `test_${uid}@test.com`,
                password: 'password123'
            })
        });

        console.log("Logging in...");
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `test_${uid}`,
                password: 'password123'
            })
        });
        const loginData = await loginRes.json();
        const token = loginData.access_token;
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        console.log("Getting account...");
        const meRes = await fetch(`${BASE_URL}/api/v1/accounts/me`, { headers });
        const meData = await meRes.json();
        const accountId = meData.id;

        console.log("Depositing...");
        await fetch(`${BASE_URL}/api/v1/accounts/${accountId}/deposit`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 1500 })
        });

        console.log("Fetching history...");
        const historyRes = await fetch(`${BASE_URL}/api/v1/transfers/history/all?limit=50`, { headers });
        const historyData = await historyRes.json();
        
        console.log("History data type:", typeof historyData);
        console.log("History isArray:", Array.isArray(historyData));
        console.log("History data:", JSON.stringify(historyData, null, 2));

        if (historyData.length > 0) {
            const amount = historyData[0].amount;
            console.log("amount type:", typeof amount);
            console.log("amount value:", amount);
            console.log("Number(amount):", Number(amount));
            console.log("isNaN(Number(amount)):", isNaN(Number(amount)));
        }
    } catch (err) {
        console.error(err);
    }
}

main();
