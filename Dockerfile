FROM alpine:3.20

RUN apk add --no-cache curl unzip

RUN curl -L -o xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip \
 && unzip xray.zip \
 && mv xray /usr/local/bin/ \
 && chmod +x /usr/local/bin/xray

COPY config.json /etc/xray/config.json

CMD ["xray", "run", "-config", "/etc/xray/config.json"]
