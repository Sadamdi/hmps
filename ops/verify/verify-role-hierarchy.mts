// Uji logika hierarki role (fungsi murni, tanpa database).
import { roleLevelOf, isTopRole, canManageRole, assertTopRoleImmutable } from '../../server/auth';
const lv = new Map<string, number>([['owner', 1], ['admin', 2], ['ketua', 3], ['bph', 4], ['medinfo', 5], ['kustom_atas', 1]]);
let pass = 0, fail = 0;
const t = (name: string, ok: boolean) => { console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`); ok ? pass++ : fail++; };
t('owner menurunkan diri sendiri ke admin -> ditolak', !assertTopRoleImmutable('owner', 'admin', lv).ok);
t('admin menaikkan staf jadi owner -> ditolak', !assertTopRoleImmutable('bph', 'owner', lv).ok);
t('role kustom level 1 dianggap paling atas', isTopRole('kustom_atas', lv));
t('admin menurunkan bph (lebih rendah) -> boleh', canManageRole('admin', 'bph', lv) && assertTopRoleImmutable('bph', 'medinfo', lv).ok);
t('admin menurunkan sesama admin -> ditolak', !canManageRole('admin', 'admin', lv));
t('admin mengubah owner -> ditolak', !canManageRole('admin', 'owner', lv));
t('bph mengubah ketua (lebih tinggi) -> ditolak', !canManageRole('bph', 'ketua', lv));
t('role tak dikenal level 999 tidak bisa mengelola', !canManageRole('asing', 'bph', lv));
console.log(`total=${pass + fail} pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
