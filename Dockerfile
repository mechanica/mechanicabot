FROM node:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY . /usr/src/app

ENV DEBUG app*
ENV NTBA_FIX_319 1

CMD [ "npm", "start" ]