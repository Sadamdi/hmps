import { db } from "../db";
import { settings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateSettings() {
  try {
    console.log("Updating settings with aboutUs and visionMission...");
    
    // Get existing settings
    const existingSettings = await db.query.settings.findFirst();
    
    if (!existingSettings) {
      console.log("No settings found to update!");
      return;
    }
    
    // Update with new fields
    await db.update(settings)
      .set({
        aboutUs: `<h2>Tentang Himpunan Mahasiswa Teknik Informatika</h2>
        <p>Himpunan Mahasiswa Teknik Informatika (HMTI) UIN Malang adalah organisasi mahasiswa yang berfokus pada pengembangan potensi akademik, minat, dan bakat mahasiswa Teknik Informatika. Didirikan pada tahun 2010, HMTI telah menjadi wadah bagi mahasiswa informatika untuk mengembangkan diri melalui berbagai kegiatan akademik dan non-akademik.</p>
        <p>HMTI memiliki berbagai divisi yang aktif mengadakan kegiatan sesuai dengan fokus masing-masing, termasuk:</p>
        <ul>
          <li>Divisi Akademik - Berfokus pada kegiatan pengembangan kemampuan akademik</li>
          <li>Divisi Humas - Menjalin kerjasama dengan berbagai pihak eksternal</li>
          <li>Divisi Pengembangan - Mengembangkan skill dan soft skill anggota</li>
          <li>Divisi Kegiatan - Mengkoordinasi berbagai acara dan kegiatan himpunan</li>
          <li>Divisi Media - Mengelola publikasi dan dokumentasi kegiatan</li>
          <li>Divisi Dana & Usaha - Mengelola pendanaan dan usaha himpunan</li>
        </ul>
        <p>Melalui berbagai kegiatan seperti seminar, workshop, kompetisi, dan kerja sama dengan industri, HMTI berupaya untuk mempersiapkan anggotanya agar siap menghadapi dunia kerja dan berkontribusi pada masyarakat.</p>`,
        visionMission: `<h2>Visi HMTI UIN Malang</h2>
        <p>Menjadi himpunan mahasiswa yang unggul, profesional, dan berkontribusi dalam pengembangan ilmu pengetahuan dan teknologi informatika yang berbasis pada nilai-nilai Islam.</p>
        
        <h2>Misi HMTI UIN Malang</h2>
        <ol>
          <li>Meningkatkan kualitas akademik dan profesionalisme anggota dalam bidang teknologi informatika</li>
          <li>Mengembangkan iklim penelitian dan inovasi di bidang informatika</li>
          <li>Membangun kerjasama dengan berbagai pihak untuk meningkatkan kompetensi anggota</li>
          <li>Menyelenggarakan kegiatan yang bermanfaat bagi pengembangan anggota dan masyarakat</li>
          <li>Menanamkan nilai-nilai Islam dalam setiap kegiatan himpunan</li>
        </ol>`
      })
      .where(eq(settings.id, existingSettings.id));
    
    console.log("Settings updated successfully!");
  } catch (error) {
    console.error("Error updating settings:", error);
  }
}

updateSettings();