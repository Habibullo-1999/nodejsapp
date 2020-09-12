'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
    user: 'app',
    password: 'pass',
    host: '0.0.0.0',
    port: 33060
});

function sendResponse(response, {status = statusOk, headers = {}, body = null}) {
    Object.entries(headers).forEach(function ([key, value]) {
        response.setHeader(key, value);
    });
    response.writeHead(status);
    response.end(body);
}

function sendJSON(response, body) {
    sendResponse(response, {
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

function map(columns) {
    return row => row.reduce((res, value, i) => ({...res, [columns[i].getColumnLabel()]: value}), {});
}

const methods = new Map();

methods.set('/posts.get', async ({response, db}) => {
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed != true')
        .orderBy('id DESC')
        .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const posts = data.map(map(columns));
    sendJSON(response, posts);
});

methods.set('/posts.getById', async ({response, searchParams, db}) => {
    if (!searchParams.has('id')) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const id = Number(searchParams.get('id'));
    if (Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id AND removed != true')
        .bind('id', id)
        .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const [post] = data.map(map(columns));

    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }

    sendJSON(response, post);
});

methods.set('/posts.post', async ({response, searchParams, db}) => {
    if (!searchParams.has('content')) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const content = searchParams.get('content');

    const table = await db.getTable('posts');
    let result = await table.insert('content').values(content).execute();

    const id = result.getAutoIncrementValue();

    result = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id')
        .bind('id', id)
        .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const [post] = data.map(map(columns));

    sendJSON(response, post);
});

const server = http.createServer(async (request, response) => {
    const {pathname, searchParams} = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }

    let session = null;
    try {
        session = await client.getSession();
        const db = await session.getSchema(schema);

        const params = {
            request,
            response,
            pathname,
            searchParams,
            db,
        };

        await method(params);
    } catch (e) {
        console.log(e);
        sendResponse(response, {status: statusInternalServerError});
    } finally {
        if (session !== null) {
            try {
                await session.close();
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen(port);
