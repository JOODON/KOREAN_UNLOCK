const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const HEADERS = {
    project: 'KNTO-PROMPTON-2026-187',
    apiKey: 'c2ec8323be418aaba1b103e20019fa9e8d5a01d5eea22584d6faf78fc5913004',
    'Content-Type': 'application/json; charset=utf-8'
};

const HASH_2 = '6d56d206ee17b6f14353e79883c53afe2c000b5f33db2cab84a54bb55fbc9c06';
const TOUR_KEY = 'oXbzlKpMlu54qLL3oie%2F0Y2wO2pw9EiT2cAaKD%2BlAd6vCPSKdZ6h%2BTWIbKTf0ofGhmeqpBD9GKNiQvNFf%2FkGdw%3D%3D';

function extractKeyword(msg) {
    const map = {
        '밀면':'밀면','냉면':'냉면','삼겹살':'삼겹살',
        '카페':'카페','커피':'카페','국수':'국수',
        '라멘':'라멘','피자':'피자','치킨':'치킨',
        '초밥':'초밥','버거':'버거','파스타':'파스타',
        'noodle':'밀면','bbq':'삼겹살','cafe':'카페'
    };
    const lower = msg.toLowerCase();
    for (const k in map) if (lower.includes(k)) return map[k];
    return '음식점';
}

function buildTourUrl(msg) {
    const keyword = extractKeyword(msg);
    return `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${TOUR_KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=prompthon&_type=json&keyword=${encodeURIComponent(keyword)}&areaCode=6`;
}

async function getTourItems(url) {
    try {
        const r = await axios.get(url);
        return (r.data?.response?.body?.items?.item || []).slice(0, 3);
    } catch(e) {
        console.error('TourAPI 에러:', e.message);
        return [];
    }
}

async function getAnswer(userMsg, category, tourItems) {
    const prompt = `카테고리: ${category}\n사용자 상황: ${userMsg}\nTourAPI 검색 결과: ${JSON.stringify(tourItems)}`;
    const r = await axios.post(
        'https://api.ennoia.so/api/preset/v2/chat/completions',
        {
            hash: HASH_2,
            params: {},
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
        },
        { headers: HEADERS, timeout: 90000, validateStatus: () => true }
    );
    console.log('2차 status:', r.status);
    const content = r.data?.choices?.[0]?.message?.content;
    let text = Array.isArray(content) ? content.map(c => c.text||'').join('') : content || '';
    console.log('2차 text:', text.slice(0, 300));
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 없음: ' + text.slice(0, 200));
    return JSON.parse(match[0]);
}

app.post('/api/chat', async (req, res) => {
    try {
        const { message, category } = req.body;
        console.log('진입 category:', category, '| message:', message);

        // waiting만 TourAPI 호출
        let tourItems = [];
        if (category === 'waiting') {
            const tourUrl = buildTourUrl(message);
            console.log('TourAPI URL:', tourUrl);
            tourItems = await getTourItems(tourUrl);
            console.log('TourAPI 결과:', tourItems.length, '개');
        }

        const answer = await getAnswer(message, category, tourItems);
        console.log('최종 type:', answer.type);
        res.json(answer);
    } catch(e) {
        console.error('에러:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => console.log('서버 실행중 :3000'));