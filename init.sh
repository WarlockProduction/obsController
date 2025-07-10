cd ./opt/obs-web
npm i
apk add --no-cache git
npm ci
npm run build

cd ../obs-web-server
npm i
npx tsc