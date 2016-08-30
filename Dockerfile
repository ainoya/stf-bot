FROM node:6-onbuild
# replace this with your application's default port

ENV DEBIAN_FRONTEND noninteractive

# Install dependencies
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -yq openjdk-7-jdk libstdc++6:i386 zlib1g:i386 libncurses5:i386 --no-install-recommends && \
    apt-get -y install --reinstall locales && \
    dpkg-reconfigure locales && \
    echo 'ja_JP.UTF-8 UTF-8' >> /etc/locale.gen && \
    locale-gen ja_JP.UTF-8 && \
    localedef --list-archive && locale -a &&  \
    update-locale &&  \
    apt-get clean

# Download and untar SDK
ENV ANDROID_SDK_URL http://dl.google.com/android/android-sdk_r24.4.1-linux.tgz
RUN curl -L "${ANDROID_SDK_URL}" | tar --no-same-owner -xz -C /usr/local
ENV ANDROID_HOME /usr/local/android-sdk-linux
ENV ANDROID_SDK /usr/local/android-sdk-linux
ENV PATH ${ANDROID_HOME}/tools:$ANDROID_HOME/platform-tools:$PATH

# Install Android SDK components

COPY android_sdk_components.env /android_sdk_components.env
RUN (while :; do echo 'y'; sleep 3; done) | android update sdk --no-ui --all --filter "$(cat ./android_sdk_components.env)"

RUN ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime

EXPOSE 4567
CMD node main.js
