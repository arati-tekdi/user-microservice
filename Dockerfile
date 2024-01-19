FROM node:16-alpine As development

WORKDIR /usr/src/app

#COPY package*.json ./

COPY . .

RUN yarn install --only=development --ignore-engines

COPY . .

RUN yarn run build

FROM node:16-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY . ./

RUN yarn install --only=production --ignore-engines

COPY . .

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/main"]
