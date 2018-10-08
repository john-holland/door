# door

the source for the aws lambda aspects of my switchbot ifttt integration to open my apartment door remotely

# for upload

`npm install`

zip door directory contents

upload via lambda "upload zip", make sure to save, and press "test"

# learned

lambda proxy integration requires resolve on returned promise in async handler
memcached and redis need to be on the same vpc as lambda, buuuuuuut neither work?
redis can do expire settings but the api is different from memcached, and the dev whom answered was highly resistent to documenting towards any particular language
CORS headers in aws lambda proxy need to be passed explicitly or else you'll get a 502
more CORS pay attention to the allows-headers header.. as that is important
lambda env variables disappeared once? idk, make a backup...