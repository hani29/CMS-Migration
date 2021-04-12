const request = require('request-promise');
const { CMS_HOST, CMS_PORT, CMS_API_KEY, WORDPRESS_HOST } = require('./constants');

async function listWordpressData(collectionName) {
    let collection = [];
    let offset = 0;
    let limit = 50;

    while (true) {
        const results = await request({
            uri: `https://${WORDPRESS_HOST}/wp-json/wp/v2/${collectionName}?per_page=${limit}&offset=${offset}`,
            json: true,
        });
        offset += limit;
        collection = [...collection, ...results];
        if(results.length < limit) break;
    }
    return collection
}

function saveData(collectionName, body) {
    return request({
        headers: {
            'Authorization': `Bearer ${CMS_API_KEY}`
        },
        uri: `http://${CMS_HOST}:${CMS_PORT}/${collectionName}`,
        json: true,
        method: 'POST',
        body
    });
}

async function getData(collectionName) {
    let collection = [];
    let offset = 0;
    let limit = 50;

    while (true) {
        const result = await request({
            headers: {
              'Authorization': `Bearer ${CMS_API_KEY}`
            },
            uri: `http://${CMS_HOST}:${CMS_PORT}/${collectionName}?_start=${offset}&_limit=${limit}`,
            json: true
        });
        offset += limit;
        collection = [...collection, ...result];
        if(result.length < limit) break;
    }

    return collection;
}

async function uploadFile(files, refId, ref, field) {
    return request({
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CMS_API_KEY}`
        },
        uri: `http://${CMS_HOST}:${CMS_PORT}/upload`,
        json: true,
        formData: {
            files
        }
    });
}

async function queryData(collectionName, query) {
    return request({
        headers: {
            'Authorization': `Bearer ${CMS_API_KEY}`
        },
        uri: `http://${CMS_HOST}:${CMS_PORT}/${collectionName}?${query}`,
        json: true,
    });
}

async function updateData(collectionName, id, body) {
    return request({
        headers: {
            'Authorization': `Bearer ${CMS_API_KEY}`
        },
        uri: `http://${CMS_HOST}:${CMS_PORT}/${collectionName}/${id}`,
        json: true,
        method: 'PUT',
        body
    });
}

async function deleteData(collectionName, id) {
    console.log('DELETING', `http://${CMS_HOST}:${CMS_PORT}/${collectionName}/${id}`)
    return request({
        headers: {
            'Authorization': `Bearer ${CMS_API_KEY}`
        },
        uri: `http://${CMS_HOST}:${CMS_PORT}/${collectionName}/${id}`,
        json: true,
        method: 'DELETE',
    });
}

async function deleteAll(collectionName) {
    console.log('DELETING', collectionName)
    const data = await getData(collectionName);
    for (let i=0; i<data.length; i++) await deleteData(collectionName, data[i].id)
}

module.exports = {
    saveData,
    getData,
    uploadFile,
    listWordpressData,
    queryData,
    updateData,
    deleteData,
    deleteAll
}