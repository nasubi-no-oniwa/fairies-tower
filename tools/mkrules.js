// データベースのルールを作る → rules/ft_rules.json（3つの陣営のデータベースに同じものを入れる）
const fs = require('fs'), path = require('path');
const ADMIN = "(auth != null && root.child('ft_admin/key').exists() && root.child('ft_admins/' + auth.uid).val() === root.child('ft_admin/key').val())";
const OPEN = "!root.child('ft_end').exists()";
const F = "$f.matches(/^([1-9]|[1-9][0-9]|100)$/)";
const R = p => `newData.parent().parent().parent().child(${p})`;   // 書いたあとの根（層/場所 の2つ下から）
const R2 = p => `newData.parent().parent().child(${p})`;
const time = x => `${x}.isNumber() && ${x}.val() <= now + 600000 && ${x}.val() >= now - 600000`;
const rules = {
  rules: {
    '.read': false, '.write': false,
    ft_admin: { '.read': false, '.write': false },
    ft_admins: { $uid: { '.read': false, '.write': `auth != null && auth.uid === $uid && root.child('ft_admin/key').exists() && newData.val() === root.child('ft_admin/key').val()` } },
    ft_u: {
      $uid: {
        '.read': false,
        c: { '.write': `${OPEN} && auth != null && auth.uid === $uid && newData.exists()`, '.validate': "newData.isNumber() && newData.val() === now && (!data.exists() || now - data.val() >= 700)" },
        k: { '.write': `${OPEN} && auth != null && auth.uid === $uid && newData.exists()`, '.validate': "newData.isNumber() && newData.val() === now && (!data.exists() || now - data.val() >= 4000)" },
        p: { '.write': `${OPEN} && auth != null && auth.uid === $uid && newData.exists()`, '.validate': "newData.isNumber() && newData.val() === now && (!data.exists() || now - data.val() >= 19000)" },
        w: { '.read': "auth != null && auth.uid === $uid", $f: { '.write': `${OPEN} && auth != null && auth.uid === $uid && newData.exists()`, '.validate': `${F} && newData.isNumber() && newData.val() === (data.exists() ? data.val() + 1 : 1) && newData.val() <= 3` } },
        $other: { '.validate': false },
      },
    },
    ft_cells: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F, '.indexOn': ['t'],
        $k: {
          '.write': `(${OPEN} && auth != null && newData.exists() && ${R("'ft_u/' + auth.uid + '/c'")}.val() === now && newData.child('g').isString() && ${R("'ft_dlog/' + $f + '/' + newData.child('g').val() + '/u'")}.val() === auth.uid && ${R("'ft_dlog/' + $f + '/' + newData.child('g').val() + '/p'")}.val() === $k && ${R("'ft_dlog/' + $f + '/' + newData.child('g').val() + '/t'")}.val() === now) || ${ADMIN}`,
          '.validate': `$k.matches(/^[0-9]{1,6}$/) && newData.hasChildren(['n', 's', 'l', 't']) && newData.child('n').isNumber() && newData.child('s').isNumber() && newData.child('s').val() >= 0 && newData.child('s').val() <= 8 && newData.child('l').isString() && newData.child('l').val().length >= 1 && newData.child('l').val().length <= 12 && newData.child('t').isNumber() && (${ADMIN} ? newData.child('n').val() >= 1 : (${time("newData.child('t')")} && newData.child('n').val() === (data.exists() ? data.child('n').val() + 1 : 1) && (!data.exists() || (newData.child('s').val() === data.child('s').val() && newData.child('l').val() === data.child('l').val()))))`,
          n: { '.validate': true }, s: { '.validate': true }, l: { '.validate': true }, t: { '.validate': true },
          g: { '.validate': "newData.isString() && newData.val().length <= 30" },
          $other: { '.validate': false },
        },
      },
    },
    ft_dlog: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F, '.indexOn': ['t'],
        $id: {
          '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && newData.child('u').val() === auth.uid && newData.child('t').val() === now && ${R("'ft_drec/' + $f + '/' + $id + '/k'")}.exists() && ${R("'ft_cells/' + $f + '/' + newData.child('p').val() + '/g'")}.val() === $id && ${R("'ft_cells/' + $f + '/' + newData.child('p').val() + '/t'")}.val() === now) || (!newData.exists() && ${ADMIN})`,
          '.validate': "$id.matches(/^[A-Za-z0-9_-]{8,24}$/) && newData.hasChildren(['p', 'u', 't', 'v', 's', 'b']) && newData.child('p').isString() && newData.child('p').val().matches(/^[0-9]{1,6}$/) && newData.child('u').isString() && newData.child('t').isNumber() && newData.child('s').isNumber() && newData.child('s').val() >= 0 && newData.child('s').val() <= 8 && newData.child('b').isNumber() && newData.child('b').val() >= 0 && newData.child('b').val() <= 10",
          p: { '.validate': true }, u: { '.validate': true }, t: { '.validate': true }, s: { '.validate': true }, b: { '.validate': true },
          v: { '.validate': "newData.isNumber() && newData.val() === 1" },
          $other: { '.validate': false },
        },
      },
    },
    ft_drec: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F,
        $id: {
          '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && ${R("'ft_dlog/' + $f + '/' + $id + '/u'")}.val() === auth.uid && ${R("'ft_dlog/' + $f + '/' + $id + '/t'")}.val() === now) || (!newData.exists() && ${ADMIN})`,
          '.validate': "newData.hasChildren(['r', 'c', 'k'])",
          r: { '.validate': "newData.isString() && newData.val().length <= 30000" },
          c: { '.validate': "newData.isString() && newData.val().length <= 30000" },
          k: { '.validate': "newData.isNumber() && newData.val() >= 1 && newData.val() <= 10000000" },
          $other: { '.validate': false },
        },
      },
    },
    ft_stat: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F,
        d: { '.write': `(${OPEN} && auth != null && newData.exists() && ${R("'ft_u/' + auth.uid + '/c'")}.val() === now) || (${ADMIN} && newData.exists())`, '.validate': `newData.isNumber() && (${ADMIN} ? newData.val() >= 0 : (newData.val() > (data.exists() ? data.val() : 0) && newData.val() <= (data.exists() ? data.val() : 0) + 6))` },
        c: { '.write': `(${OPEN} && auth != null && newData.exists() && ${R("'ft_u/' + auth.uid + '/k'")}.val() === now) || (${ADMIN} && newData.exists())`, '.validate': `newData.isNumber() && (${ADMIN} ? newData.val() >= 0 : newData.val() === (data.exists() ? data.val() + 1 : 1))` },
        m: { '.write': `(${OPEN} && auth != null && newData.exists() && (${R("'ft_u/' + auth.uid + '/c'")}.val() === now || ${R("'ft_u/' + auth.uid + '/k'")}.val() === now)) || (${ADMIN} && newData.exists())`, '.validate': `newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000 && (${ADMIN} || !data.exists() || newData.val() >= data.val())` },
        $other: { '.validate': false },
      },
    },
    ft_clear: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F, '.indexOn': ['t'],
        $id: {
          '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && newData.child('u').val() === auth.uid && newData.child('t').val() === now && ${R("'ft_u/' + auth.uid + '/k'")}.val() === now && ${R("'ft_u/' + auth.uid + '/w/' + $f")}.val() !== root.child('ft_u/' + auth.uid + '/w/' + $f).val()) || (!newData.exists() && ${ADMIN})`,
          '.validate': "$id.matches(/^[A-Za-z0-9_-]{8,24}$/) && newData.hasChildren(['n', 'x', 't', 'r', 'c', 'k', 'u', 's', 'b']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('x').isString() && newData.child('x').val().matches(/^[A-Za-z0-9_]{0,15}$/) && newData.child('t').isNumber() && newData.child('r').isString() && newData.child('r').val().length >= 3 && newData.child('r').val().length <= 60000 && newData.child('c').isString() && newData.child('c').val().length <= 30000 && newData.child('k').isNumber() && newData.child('k').val() >= 1 && newData.child('u').isString() && newData.child('s').isNumber() && newData.child('s').val() >= 0 && newData.child('s').val() <= 8 && newData.child('b').isNumber() && newData.child('b').val() >= 0 && newData.child('b').val() <= 10",
          n: { '.write': `${ADMIN} && data.exists() && newData.isString()`, '.validate': true }, t: { '.validate': true }, r: { '.validate': true }, c: { '.validate': true }, k: { '.validate': true }, u: { '.validate': true }, s: { '.validate': true }, b: { '.validate': true },
          x: { '.write': `(${OPEN} && auth != null && data.exists() && data.val() === '' && data.parent().child('u').val() === auth.uid && now - data.parent().child('t').val() < 900000 && newData.isString() && newData.val().matches(/^[A-Za-z0-9_]{1,15}$/)) || (${ADMIN} && data.exists() && newData.isString() && newData.val() === '')`, '.validate': true },
          $other: { '.validate': false },
        },
      },
    },
    ft_open: {
      '.read': true,
      $f: {
        '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && newData.child('u').val() === auth.uid && newData.child('t').val() === now && ${R2("'ft_clear/' + $f + '/' + newData.child('id').val() + '/u'")}.val() === auth.uid) || (!newData.exists() && ${ADMIN})`,
        '.validate': `${F} && newData.hasChildren(['t', 'n', 'x', 'id', 'u']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('x').isString() && newData.child('x').val().matches(/^[A-Za-z0-9_]{0,15}$/) && newData.child('t').isNumber() && newData.child('id').isString() && newData.child('id').val().length <= 30 && newData.child('u').isString()`,
        t: { '.validate': true }, id: { '.validate': true }, u: { '.validate': true },
        n: { '.write': `${ADMIN} && data.exists() && newData.isString()`, '.validate': true },
        x: { '.write': `(${OPEN} && auth != null && data.exists() && data.val() === '' && data.parent().child('u').val() === auth.uid && now - data.parent().child('t').val() < 900000 && newData.isString() && newData.val().matches(/^[A-Za-z0-9_]{1,15}$/)) || (${ADMIN} && data.exists() && newData.isString() && newData.val() === '')`, '.validate': true },
        $other: { '.validate': false },
      },
    },
    ft_end: { '.read': true, '.write': ADMIN, '.validate': "newData.hasChildren(['t', 'w']) && newData.child('t').isNumber() && newData.child('w').isString() && newData.child('w').val().matches(/^(g|r|b)$/)" },
    ft_rm: { '.read': true, $f: { '.write': ADMIN, '.validate': `${F} && newData.hasChildren(['t']) && ${time("newData.child('t')")}`, t: { '.validate': true }, $other: { '.validate': false } } },
    ft_reset: { '.read': true, $f: { '.write': ADMIN, '.validate': `${F} && newData.hasChildren(['t']) && ${time("newData.child('t')")}`, t: { '.validate': true }, $other: { '.validate': false } } },
    // 屍が足場になった数：死んだ・越えた記録と同じ書きこみの中でだけ（ft_u の c か k をいま書いた人）、1ずつ増やせる
    ft_help: {
      '.read': true,
      $f: {
        '.write': `!newData.exists() && ${ADMIN}`, '.validate': F,
        $k: { '.write': `(${OPEN} && auth != null && newData.exists() && (${R("'ft_u/' + auth.uid + '/c'")}.val() === now || ${R("'ft_u/' + auth.uid + '/k'")}.val() === now)) || ${ADMIN}`, '.validate': "$k.matches(/^[0-9]{1,6}$/) && newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1" },
      },
    },
    // 掲示板：陣営の掲示板（ft_board）と、全体の掲示板（ft_gboard。緑のデータベースに置く）。1人20秒に1回まで（ft_u の p）
    ft_board: {
      '.read': true, '.indexOn': ['t'],
      $id: {
        '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && newData.child('u').val() === auth.uid && newData.child('t').val() === now && ${R2("'ft_u/' + auth.uid + '/p'")}.val() === now) || (!newData.exists() && ${ADMIN})`,
        '.validate': "$id.matches(/^[A-Za-z0-9_-]{8,30}$/) && newData.hasChildren(['n', 'm', 't', 'u', 's', 'l', 'f']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('m').isString() && newData.child('m').val().length >= 1 && newData.child('m').val().length <= 120 && newData.child('s').isNumber() && newData.child('s').val() >= 0 && newData.child('s').val() <= 8 && newData.child('l').isString() && newData.child('l').val().matches(/^(ja|en|zh|ko)$/) && newData.child('f').isNumber() && newData.child('f').val() >= 0 && newData.child('f').val() <= 101 && newData.child('u').isString() && newData.child('t').isNumber()",
        n: { '.validate': true }, m: { '.validate': true }, t: { '.validate': true }, u: { '.validate': true }, s: { '.validate': true }, l: { '.validate': true }, f: { '.validate': true }, r: { '.write': `auth != null && ${R("'ft_board_r/' + $id + '/' + auth.uid")}.val() === true && !root.child('ft_board_r/' + $id + '/' + auth.uid).exists()`, '.validate': "newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1" }, a: { '.validate': "newData.isString() && newData.val().matches(/^(g|r|b)$/)" },
        $other: { '.validate': false },
      },
    },
    ft_gboard: {
      '.read': true, '.indexOn': ['t'],
      $id: {
        '.write': `(${OPEN} && auth != null && !data.exists() && newData.exists() && newData.child('u').val() === auth.uid && newData.child('t').val() === now && ${R2("'ft_u/' + auth.uid + '/p'")}.val() === now) || (!newData.exists() && ${ADMIN})`,
        '.validate': "$id.matches(/^[A-Za-z0-9_-]{8,30}$/) && newData.hasChildren(['n', 'm', 't', 'u', 's', 'l', 'f']) && newData.child('n').isString() && newData.child('n').val().length >= 1 && newData.child('n').val().length <= 12 && newData.child('m').isString() && newData.child('m').val().length >= 1 && newData.child('m').val().length <= 120 && newData.child('s').isNumber() && newData.child('s').val() >= 0 && newData.child('s').val() <= 8 && newData.child('l').isString() && newData.child('l').val().matches(/^(ja|en|zh|ko)$/) && newData.child('f').isNumber() && newData.child('f').val() >= 0 && newData.child('f').val() <= 101 && newData.child('u').isString() && newData.child('t').isNumber()",
        n: { '.validate': true }, m: { '.validate': true }, t: { '.validate': true }, u: { '.validate': true }, s: { '.validate': true }, l: { '.validate': true }, f: { '.validate': true }, r: { '.write': `auth != null && ${R("'ft_gboard_r/' + $id + '/' + auth.uid")}.val() === true && !root.child('ft_gboard_r/' + $id + '/' + auth.uid).exists()`, '.validate': "newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1" }, a: { '.validate': "newData.isString() && newData.val().matches(/^(g|r|b)$/)" },
        $other: { '.validate': false },
      },
    },
    // 通報：1人1回ずつ。3人に通報された投稿は、端末で見せない
    ft_board_r: { $id: { $uid: { '.write': "auth != null && auth.uid === $uid && !data.exists() && newData.val() === true" } } },
    ft_gboard_r: { $id: { $uid: { '.write': "auth != null && auth.uid === $uid && !data.exists() && newData.val() === true" } } },
    ft_pin: { '.read': true, '.write': ADMIN, '.validate': "newData.isString() && newData.val().length <= 300" },
    ft_gpin: { '.read': true, '.write': ADMIN, '.validate': "newData.isString() && newData.val().length <= 300" },
    // 配信中の人（管理人だけが出し入れ。緑のデータベースで使う）
    ft_live: { '.read': true, '.write': ADMIN, $id: { '.validate': "newData.hasChildren(['n', 'u', 't'])", n: { '.validate': "newData.isString() && newData.val().length >= 1 && newData.val().length <= 20" }, u: { '.validate': "newData.isString() && newData.val().beginsWith('https://') && newData.val().length <= 308" }, m: { '.validate': "newData.isString() && newData.val().length <= 30" }, t: { '.validate': "newData.val() === now" }, $other: { '.validate': false } } },
    ft_ckpt: { '.read': true, '.write': ADMIN, '.validate': "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100" },
  },
};
fs.mkdirSync(path.join(__dirname, '..', 'rules'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'rules', 'ft_rules.json'), JSON.stringify(rules, null, 2));
console.log('ok', JSON.stringify(rules).length);
