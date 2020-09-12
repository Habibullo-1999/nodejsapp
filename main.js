'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
//const statusNoContent = 204;
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

function sendResponse(response, { status = statusOk, headers = {}, body = null }) {
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
  return row => row.reduce((res, value, i) => ({ ...res, [columns[i].getColumnLabel()]: value }), {});
}

const methods = new Map();

methods.set('/posts.get', async ({ response, db }) => {
  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('removed=:removed')
    .bind('removed', false)
    .orderBy('id DESC')
    .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));
  sendJSON(response, posts);
});

methods.set('/posts.getById', async ({ response, searchParams, db }) => {
  const id = Number(searchParams.get('id'));
  const table = await db.getTable('posts');
  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .orderBy('id DESC')
    .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));


  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }


  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const post = posts.filter(o => !o.removed).find(o => o.id === id);
  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});

methods.set('/posts.post', async ({ response, searchParams, db }) => {

  if (!searchParams.has('content')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const content = searchParams.get('content');
  const table = await db.getTable('posts');
  await table.insert('content')
    .values(content)
    .execute();

  const result = await table.select(['id', 'content', 'likes', 'created'])
    .orderBy('id DESC')
    .execute();
  result.getAffectedItemsCount();
  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));
  sendJSON(response, posts[0]);
});

methods.set('/posts.edit', async ({ response, searchParams, db }) => {
  const id = Number(searchParams.get('id'));
  const content = searchParams.get('content');


  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }


  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  if (!searchParams.has('content')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const table = await db.getTable('posts');
  await table.update()
    .set('content', content)
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();

  const result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .orderBy('id DESC')
    .execute();

  result.getAffectedItemsCount();
  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns));
  const post = posts.find(value => value.id === id);
  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }

  sendJSON(response, post);
});

methods.set('/posts.delete', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = await db.getTable('posts');
  let result = await table.select(['id', 'content', 'likes', 'created', 'removed'])
    .where('id=:id')
    .bind('id', id)
    .execute();

  let data = result.fetchAll();
  let columns = result.getColumns();
  let posts = data.map(map(columns));
  let post = posts.find(value => value.removed !== 1);
  console.log(post);

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }
  await table.update()
    .set('removed', true)
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();

  result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id')
    .bind('id', id)
    .execute();
  data = result.fetchAll();
  columns = result.getColumns();
  posts = data.map(map(columns));
  post = posts.find(value => value.id === id);
  sendJSON(response, post);
});

methods.set('/posts.restore', async ({ response, searchParams, db }) => {
  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = await db.getTable('posts');
  let result = await table.select(['id', 'content', 'likes', 'created', 'removed'])
    .where('id=:id')
    .bind('id', id)
    .execute();

  let data = result.fetchAll();
  let columns = result.getColumns();
  let posts = data.map(map(columns));
  let post = posts.find(value => value.removed !== 0);
  console.log(post);

  if (post === undefined) {
    sendResponse(response, { status: statusNotFound });
    return;
  }
  await table.update()
    .set('removed', false)
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', true)
    .execute();

  result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id')
    .bind('id', id)
    .execute();
  data = result.fetchAll();
  columns = result.getColumns();
  posts = data.map(map(columns));
  post = posts.find(value => value.id === id);
  sendJSON(response, post);
});

methods.set('/posts.like', async ({ response, searchParams, db }) => {
  const id = Number(searchParams.get('id'));

  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = await db.getTable('posts');

  let result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();

  result.getAffectedItemsCount();
  let data = result.fetchAll();
  if (data.length === 0) {
    sendResponse(response, { status: statusNotFound });
    return;
  }
  let columns = result.getColumns();
  let posts = data.map(map(columns));
  let post = posts.find(val => val.id === id);
  const likes = post.likes;
  result = await table.update()
    .set('likes', likes + 1)
    .where('removed = :removed AND id = :id')
    .bind('removed', false)
    .bind('id', id)
    .execute();
  result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();
  data = result.fetchAll();
  columns = result.getColumns();
  posts = data.map(map(columns));
  post = posts.find(val => val.id === id);

  sendJSON(response, post);

});
methods.set('/posts.dislike', async ({ response, searchParams, db }) => {
  const id = Number(searchParams.get('id'));

  if (!searchParams.has('id')) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  if (Number.isNaN(id)) {
    sendResponse(response, { status: statusBadRequest });
    return;
  }
  const table = await db.getTable('posts');

  let result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();

  result.getAffectedItemsCount();
  let data = result.fetchAll();
  if (data.length === 0) {
    sendResponse(response, { status: statusNotFound });
    return;
  }
  let columns = result.getColumns();
  let posts = data.map(map(columns));
  let post = posts.find(val => val.id === id);
  const likes = post.likes;
  result = await table.update()
    .set('likes', likes -1)
    .where('removed = :removed AND id = :id')
    .bind('removed', false)
    .bind('id', id)
    .execute();
  result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id=:id AND removed=:removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();
  data = result.fetchAll();
  columns = result.getColumns();
  posts = data.map(map(columns));
  post = posts.find(val => val.id === id);

  sendJSON(response, post);

});
const server = http.createServer(async (request, response) => {
  const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

  const method = methods.get(pathname);
  if (method === undefined) {
    sendResponse(response, { status: statusNotFound });
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
    sendResponse(response, { status: statusInternalServerError });
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
