const request = require('request');
const cheerio = require('cheerio')

const {
    saveData,
    getData,
    uploadFile,
    listWordpressData,
    updateData,
    queryData,
    deleteAll
} = require('./helpers');
const {  CATEGORIES, TAGS, USERS, POSTS, MEDIA_CONTENTS, MEDIA, WORDPRESS_HOST, CMS_HOST, CMS_PORT } = require('./constants');

/**
 * Migrate Categories
 * @returns {Promise<void>}
 */
async function migrateCategories() {
    const collection = await listWordpressData(CATEGORIES);
    for (let i=0; i<collection.length; i++) {
        const { id, name, description, slug } = collection[i];
        await saveData(CATEGORIES, { wordpress_id: id, name, description, slug });
    }
}

/**
 * Migrate Tags
 * @returns {Promise<void>}
 */
async function migrateTags() {
    const collection = await listWordpressData(TAGS);
    for (let i=0; i<collection.length; i++) {
        const { id, name, description, slug } = collection[i];
        await saveData(TAGS, { wordpress_id: id, name, description, slug });
    }
}

/**
 * Migrate Users
 * @returns {Promise<void>}
 */
async function migrateUsers() {
    const collection = await listWordpressData(USERS);
    for (let i=0; i<collection.length; i++) {
        const { id, name, description, slug, avatar_urls } = collection[i];
        await saveData(USERS, {
            wordpress_id: id,
            name,
            description,
            username: slug,
            avatar_url: avatar_urls['96'],
            email: `${slug}@projectgamechanger.com`,
            password: 'password'
        });
    }
}

/**
 * Migrate Posts
 * @returns {Promise<void>}
 */
async function migratePosts() {
    const collection = await listWordpressData(POSTS);
    const users = await getData(USERS);
    const tags = await getData(TAGS);
    const categories = await getData(CATEGORIES);

    for (let i=0; i<collection.length; i++) {
        const {
            id,
            title: { rendered: title },
            content: { rendered: content },
            date_gmt: date,
            status,
            slug,
            excerpt: { rendered: excerpt },
            featured_media,
            comment_status,
            ping_status,
            format,
            categories: postCategories,
            tags: postTags,
            author: postAuthor
        } = collection[i];
        const categoryIds = categories.filter(category => postCategories.includes(category.wordpress_id)).map(category => category.id);
        const tagIds = tags.filter(tag => postTags.includes(tag.wordpress_id)).map(tag => tag.id);
        const author = users.filter(user => user.wordpress_id === postAuthor).map(user => user.id);
        await saveData(POSTS, {
            wordpress_id: id,
            date,
            title,
            content,
            status,
            slug,
            excerpt,
            comment_status,
            ping_status,
            format,
            categories: categoryIds,
            tags: tagIds,
            author: author[0]
        });
    }
}

/**
 * Migrate Media
 * @returns {Promise<void>}
 */
async function migrateMedia() {
    const collection = await listWordpressData(MEDIA);
    const users = await getData(USERS);
    const posts = await getData(POSTS);

    console.log('MEDIA', collection.length)
    console.log('POSTS', posts.length)

    for (let i=0; i<collection.length; i++) {
        const {
            id: wordpress_id,
            title: {rendered: title},
            caption: {rendered: caption},
            alt_text,
            date_gmt: date,
            status,
            slug,
            comment_status,
            ping_status,
            author: postAuthor,
            media_type,
            mime_type,
            post: postId,
            source_url,
        } = collection[i];

        const author = users.filter(user => user.wordpress_id === postAuthor).map(user => user.id);
        const post = posts.filter(post => post.wordpress_id === postId).map(post => post.id);

        const urlComponents = source_url.split('/')

        const files = {
            'value': request.get(source_url),
            'options': {
                'filename': urlComponents[urlComponents.length-1],
                'contentType': null
            }
        };

        let result = null;

        try {
            result = await uploadFile(files)
        } catch (e) {
            console.log('UPLOAD FILE')
        }

        try {
            await saveData(MEDIA_CONTENTS, {
                wordpress_id,
                title,
                caption,
                alt_text,
                date,
                status,
                slug,
                comment_status,
                ping_status,
                author: author[0],
                post: post[0],
                media_type,
                mime_type,
                source: [result[0].id]
            });
        } catch (e) {
            console.log('SAVE DATA',e)
        }
    }
}

/**
 * Associate a post with featured_media
 * @returns {Promise<void>}
 */
async function associatePostWithFeaturedMedia() {
    const posts = await getData(POSTS);
    console.log('POSTS', posts.length)
    const wordpressPosts = await listWordpressData(POSTS);
    console.log('wordpressPosts', wordpressPosts.length)

    for (let i=0; i<posts.length; i++) {
        const featured_media = wordpressPosts.filter(post => post.id === posts[i].wordpress_id)[0].featured_media
        const media = await queryData(MEDIA_CONTENTS, `wordpress_id=${featured_media}`)
        if(media.length > 0) {
            posts[i].featured_media_wordpress_id = featured_media;
            posts[i].featured_media = media[0].id;
            console.log('MEDIA', media[0].id, i, posts[i].id)
        }
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

/**
 * Associate a post with categories
 * @returns {Promise<void>}
 */
async function associatePostWithCategories() {
    const posts = await getData(POSTS);
    console.log('POSTS', posts.length)
    const wordpressPosts = await listWordpressData(POSTS);
    console.log('wordpressPosts', wordpressPosts.length)

    for (let i=0; i<posts.length; i++) {
        const wordpressPost = wordpressPosts.filter(post => post.id === posts[i].wordpress_id)[0]
        console.log(`wordpress_id_in=${wordpressPost.categories.join('&wordpress_id_in=')}`)
        const categories = await queryData(CATEGORIES, `wordpress_id_in=${wordpressPost.categories.join('&wordpress_id_in=')}`)
        console.log(categories.map(category => category.id))
        if(categories.length > 0) {
            posts[i].categories = categories.map(category => category.id);
        }
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

/**
 * Associate a post with tags
 * @returns {Promise<void>}
 */
async function associatePostWithTags() {
    const posts = await getData(POSTS);
    console.log('POSTS', posts.length)
    const wordpressPosts = await listWordpressData(POSTS);
    console.log('wordpressPosts', wordpressPosts.length)

    for (let i=0; i<posts.length; i++) {
        const wordpressPost = wordpressPosts.filter(post => post.id === posts[i].wordpress_id)[0]
        console.log(`wordpress_id_in=${wordpressPost.tags.join('&wordpress_id_in=')}`)
        const tags = await queryData(TAGS, `wordpress_id_in=${wordpressPost.tags.join('&wordpress_id_in=')}`)
        console.log(tags.map(category => category.id))
        if(tags.length > 0) {
            posts[i].tags = tags.map(category => category.id);
        }
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

/**
 *
 * @returns {Promise<void>}
 */
async function replaceHref() {
    const posts = await getData(POSTS);
    const wordpressPosts = await listWordpressData(POSTS);

    console.log('POSTS', posts.length)

    for (let i = 0; i<posts.length; i++) {
        const $ = cheerio.load(posts[i].content)
        $('a').each((i, el) => {
            let link = $(el).attr('href')

            console.log('LINK', link)

            if(link.includes(WORDPRESS_HOST)) {
                const wordpressPost = wordpressPosts.filter(post => post.link === link)
                if (wordpressPost.length > 0) {
                    const doePost = posts.filter(post => wordpressPost[0].id === post.wordpress_id)
                    console.log(doePost[0].categories.length)
                    if(doePost.length > 0 && doePost[0].categories.length > 0) {
                        const categories = doePost[0].categories.filter(category => category.slug === 'race-profiles' || category.slug === 'development-log')
                        if(categories.length > 0) {
                            let categorySlug = categories[0].slug
                            if(categorySlug === 'race-profiles') {
                                categorySlug = 'race-profile'
                            }
                            link = `/${categorySlug}/${doePost[0].id}`
                            $(el).attr('href', link)
                        }
                    }
                }
            }
        });
        posts[i].content = $('body').html()
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

async function replaceMediaUrls() {
    const mediaContents = await getData(MEDIA_CONTENTS);
    const posts = await getData(POSTS)
    const wordpressMediaContents = await listWordpressData(MEDIA);

    for (let i = 0; i<posts.length; i++) {
        const $ = cheerio.load(posts[i].content)
        $('video').each((i, el) => {
            let link = $(el).attr('src')
            console.log('OLD VIDEO LINK', link)
            if(link && link.includes(WORDPRESS_HOST)) {
                const wordpressMediaContent = wordpressMediaContents.filter(media => media.source_url === link)
                console.log('wordpressVideoContent', wordpressMediaContent.length)
                if (wordpressMediaContent.length > 0) {
                    const deoMediaContent = mediaContents.filter(mediaContent => wordpressMediaContent[0].id === mediaContent.wordpress_id)
                    console.log('DOE VIDEO CONTENT', deoMediaContent.length)
                    if(deoMediaContent[0]) {
                        link = deoMediaContent[0].source[0].url
                        console.log('NEW VIDEO LINK', link)
                        $(el).attr('src', link)
                    }
                }
            }
        })
        $('audio').each((i, el) => {
            let link = $(el).attr('src')
            console.log('OLD AUDIO LINK', link)
            if(link && link.includes(WORDPRESS_HOST)) {
                const wordpressMediaContent = wordpressMediaContents.filter(media => media.source_url === link)
                console.log('wordpressAudioContent', wordpressMediaContent.length)
                if (wordpressMediaContent.length > 0) {
                    const deoMediaContent = mediaContents.filter(mediaContent => wordpressMediaContent[0].id === mediaContent.wordpress_id)
                    console.log('DOE AUDIO CONTENT', deoMediaContent.length)
                    if(deoMediaContent[0]) {
                        link = deoMediaContent[0].source[0].url
                        console.log('OLD VIDEO LINK', link)
                        $(el).attr('src', link)
                    }
                }
            }
        })
        posts[i].content = $('body').html()
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

async function replaceImageUrls() {
    const mediaContents = await getData(MEDIA_CONTENTS);
    const posts = await getData(POSTS)

    for (let i = 0; i<posts.length; i++) {
        const $ = cheerio.load(posts[i].content)
        $('img').each((i, el) => {
            const imageId = $(el).attr('data-id')
            console.log('IMAGE CONTENT', imageId)
            const mediaContent = mediaContents.filter(media =>  `${media.wordpress_id}` === imageId)
            console.log('MEDIA CONTENT', mediaContent.length)
            if(mediaContent[0]) {
                const { hash, ext } =  mediaContent[0].source[0];
                const link = `http://185.14.184.59:1337/image-resize/${hash}${ext}`

                console.log('LINK', link)

                let mediumFileSizeUrl = $(el).attr('data-medium-file')
                let mediumFileSize = null;
                if(mediumFileSizeUrl) {
                    mediumFileSizeUrl = new URL(mediumFileSizeUrl);
                    mediumFileSize = mediumFileSizeUrl.searchParams.get('fit').split(',');
                    $(el).attr('data-medium-file', `${link}?w=${mediumFileSize[0]}&h=${mediumFileSize[1]}`)
                }

                let largeFileSizeUrl = $(el).attr('data-large-file')
                let largeFileSize = null;
                if(largeFileSizeUrl) {
                    largeFileSizeUrl = new URL(largeFileSizeUrl);
                    largeFileSize = largeFileSizeUrl.searchParams.get('fit').split(',');
                    $(el).attr('data-large-file', `${link}?w=${largeFileSize[0]}&h=${largeFileSize[1]}`)
                }

                let srcUrl =  $(el).attr('src');
                let srcSize = null;
                if(srcUrl) {
                    srcUrl =  new URL(srcUrl)
                    srcSize = srcUrl.searchParams.get('resize')
                    if(srcSize) {
                        srcSize = srcSize.split(',')
                        $(el).attr('src', `${link}?w=${srcSize[0]}&h=${srcSize[1]}`)
                    } else {
                        $(el).attr('src', `${link}`)
                    }
                }

                let srcSet = $(el).attr('srcset')
                if(srcSet) {
                    srcSet = srcSet.split(', ').map(src => {
                        src = src.split(' ');
                        return `${link}?w=${src[1].replace('w', '')} ${src[1]}`
                    }).join(', ')
                    $(el).attr('srcset', srcSet)
                }

                $(el).attr('data-permalink', link)
                $(el).attr('data-full-url', link)
                $(el).attr('data-permalink', link)
            }
        })
        posts[i].content = $('body').html()
        await updateData(POSTS, posts[i].id, posts[i])
    }
}

async function clear() {
    await deleteAll(CATEGORIES)
    await deleteAll(TAGS)
    await deleteAll(USERS)
    await deleteAll(POSTS)
    await deleteAll(MEDIA_CONTENTS)
}

async function main() {
    // await clear()
    // await migrateCategories()
    // await migrateTags()
    // await migrateUsers()
    // await migratePosts()
    // await migrateMedia()
    // await associatePostWithCategories()
    // await associatePostWithTags()
    // await associatePostWithFeaturedMedia()
    // await replaceHref()
    // await replaceMediaUrls()
    await replaceImageUrls();
}

main();

