const request = require('request');
const AWS = require('aws-sdk')

const IFTTT_ADDRESS = process.env.IFTTT_ADDRESS
const PASSWORDS = JSON.parse(process.env.PASSWORDS)
const USERS = JSON.parse(process.env.USERS)
const HEADERS = {
    "X-Requested-With": '*',
    "Access-Control-Allow-Headers": 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-requested-with,Access-Control-Allow-Origin',
    "Access-Control-Allow-Origin": '*',
    "Access-Control-Allow-Methods": 'POST,GET,OPTIONS',
    "Access-Control-Allow-Credentials" : true
}
const ERROR_RESPONSE = {
    "isBase64Encoded": false,
    "statusCode": 500,
    "headers": HEADERS,
    "body": JSON.stringify({
        result: 'error',
        error: 'internal server errorz' 
    })
}

const Memcached = require('memcached');
const memcachedAddress = process.env.MEMCACHED_ADDRESS

let memcached = new Memcached(memcachedAddress)
const KEY_CACHE_DURATION = 600

const getOrSetDefault = async (key, defaultValue) => new Promise((resolve, reject) => {
    memcached.get(key, function(err,data) {
        if (err) {
            reject(err)
            return
        }
        
        if(data) {
            resolve(data)
        } else {
            memcached.set(key, defaultValue, KEY_CACHE_DURATION, err => err ? reject(err) : resolve(defaultValue))
        }
    })
})

const setCache = async (key, value) => new Promise((resolve, reject) => {
    memcached.set(key, value, KEY_CACHE_DURATION, err => err ? reject(err) : resolve(value))
})

//we should really be using the lifetime value for key checks
const cacheCheck = async (cacheip, now) => {
    let access = await getOrSetDefault(cacheip, { lastAccessed: now, count: 0 })
    console.log("access ", access)
    //if we've tried too many times, just error out
    if (now - access.lastAccessed < (60 * 1000) && access.count > 5) {
        return [true, access]
    } else if (now - access.lastAccessed > (60 * 1000)) {
        access.lastAccessed = now
        access.count = 0
        await setCache(cacheip, access)
    } else {
        access.count = access.count + 1
        await setCache(cacheip, access)
    }
    
    return [false, access, cacheip]
}

async function resetAccess(access, now, cacheip) {
    access.lastAccessed = now
    access.count = 0
    await setCache(cacheip, access)
}

const errorresult = message => {
    return {
        "isBase64Encoded": false,
        "statusCode": 500,
        "headers": HEADERS,
        "body": JSON.stringify({
            result: "error",
            error: message
        })
    }
}
    
const CACHE_ENABLED = false
exports.handler = async (event, context) => {
/**
 * todo:
 * 
 * once i get the switch bots, i should set up https://ifttt.com/switchbot
 * if the ifttt service continues to be hecka laggy, consider switching to local hub or other api etc
 * maybe add a note to the user if the result is locked out to just text me
 * 
 */
    let password = (event.headers && 'authorization' in event.headers) ? event.headers['authorization'] : ''
    if (!password) password = (event.headers && 'Authorization' in event.headers) ? event.headers['Authorization'] : ''
    console.log("password? " + !!password)
    
    let now = new Date().getTime()
    
    let cacheip = 'requestContext' in event ? event['requestContext']['identity']['sourceIp'] : 'unknown-or-test'
    console.log("cacheip " + cacheip)
    console.log(password)
    
    let overlimit, access;
    
    if (CACHE_ENABLED) [overlimit, access] = await cacheCheck(cacheip, now)
    
    if ((CACHE_ENABLED && overlimit) || !PASSWORDS.includes(password.substring(password.indexOf(':')+1))) {
        return ERROR_RESPONSE
    }
    
    //if we entered a correct password, then reset access count anyways
    if (CACHE_ENABLED) await resetAccess(access, now, cacheip)
    
    console.log('gets here')
    
    return new Promise((resolve, reject) => {
        const req = request.post(IFTTT_ADDRESS, {
            json: {
                "value1" : USERS[password]
            }
        }, (error, res, body) => {
            if (error) {
                reject(errorresult(error))
            } else {
                resolve({
                    "isBase64Encoded": false,
                    "statusCode": res.statusCode,
                    "headers": HEADERS,
                    "body": JSON.stringify({
                        result: "success",
                        success: "opened!"
                    })
                });
            }
        });
    });
};