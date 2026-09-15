import json, sys, datetime
d = json.load(sys.stdin)
for x in d['deployments']['deployments']:
    t = datetime.datetime.fromtimestamp(x['created']/1000)
    msg = x['meta'].get('githubCommitMessage') or x['meta'].get('gitCommitMessage','')
    sha = x['meta'].get('githubCommitSha') or x['meta'].get('gitCommitSha','')
    ref = x['meta'].get('githubCommitRef') or x['meta'].get('gitCommitRef','')
    state = x['state']
    print(f"{t} [{state:6}] {ref:35} {sha[:7]} {msg[:60]}")
