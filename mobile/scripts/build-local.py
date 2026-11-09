"""Local Android release build. Requires a JDK and installed Android SDK, not cloud credentials."""
import os
import pathlib
import subprocess
import urllib.parse

root = pathlib.Path(__file__).resolve().parents[1]
env = os.environ.copy()
sdk = env.get('ANDROID_SDK_ROOT') or env.get('ANDROID_HOME')
if not sdk or not env.get('JAVA_HOME'):
    raise SystemExit('Configure ANDROID_SDK_ROOT and JAVA_HOME first.')
env['ANDROID_HOME'] = env['ANDROID_SDK_ROOT'] = sdk
env['NODE_ENV'] = 'production'
env['EXPO_OFFLINE'] = '1'
proxy = urllib.parse.urlparse(env.get('HTTPS_PROXY', ''))
options = ' -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts'
if proxy.hostname:
    options += f' -Dhttp.proxyHost={proxy.hostname} -Dhttp.proxyPort={proxy.port or 80} -Dhttps.proxyHost={proxy.hostname} -Dhttps.proxyPort={proxy.port or 80}'
for name in ['JAVA_TOOL_OPTIONS', 'GRADLE_OPTS']:
    env[name] = env.get(name, '') + options
(root / 'android/local.properties').write_text('sdk.dir=' + sdk + '\n')
command = ['./gradlew', ':app:assembleRelease', '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a', '-Pandroid.enableMinifyInReleaseBuilds=false', '-Pandroid.enableShrinkResourcesInReleaseBuilds=false', '--max-workers=2', '--console=plain', '--info', '--no-daemon', '-Dorg.gradle.internal.http.connectionTimeout=20000', '-Dorg.gradle.internal.http.socketTimeout=30000']
log_path = pathlib.Path(env.get('ANDROID_BUILD_LOG', str(root / 'android/build.log')))
with log_path.open('w') as log:
    result = subprocess.run(command, cwd=root / 'android', env=env, stdout=log, stderr=log)
print('Gradle exit:', result.returncode)
print('Log:', log_path)
raise SystemExit(result.returncode)
