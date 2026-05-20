import json
d=json.load(open('DASE/coverage/coverage-final.json'))
for k in d:
    f=d[k]
    nf=[fk for fk in f['fnMap'] if f['f'][fk]==0]
    ns=[sk for sk in f['statementMap'] if f['s'][sk]==0]
    nb=[bk for bk in f['branchMap'] if 0 in f['b'][bk]]
    if nf or ns or nb:
        rel = k.replace('\\', '/').split('/DASE/')[-1] if '/DASE/' in k.replace('\\', '/') else k
        print(rel)
        for fk in nf:
            m=f['fnMap'][fk]
            print(' FUNC line', m.get('decl',{}).get('start',{}).get('line','?'),'-',m.get('name'))
        for sk in ns:
            print(' STMT line', f['statementMap'][sk]['start']['line'])
        for bk in nb:
            m=f['branchMap'][bk]
            line = m.get('loc',{}).get('start',{}).get('line') or m.get('line','?')
            print(' BRANCH line', line, 'type', m.get('type','?'))
