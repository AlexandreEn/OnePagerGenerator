use crate::csv_handler::read_csv_all;
use rayon::prelude::*;
use regex::Regex;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct GenConfig {
    pub standard_csv: Option<String>,
    pub prev_year_csv: Option<String>,
    pub template_dir: String,
    pub output_dir: String,
    pub languages: Vec<String>,
    pub mappings: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenStats {
    pub total_files: u32,
    pub total_time_secs: f64,
    pub success_count: u32,
    pub error_count: u32,
}

pub fn generate_pptx(
    config: GenConfig,
    update_progress: impl Fn(f64, String) + Sync + Send,
) -> Result<GenStats, String> {
    let start_time = std::time::Instant::now();
    // 1. Scan Templates
    let templates = scan_templates(&config.template_dir, &config.languages)?;
    if templates.is_empty() {
        return Err("No templates found for selected languages".to_string());
    }

    // 2. Load CSVs
    let mut data_groups = HashMap::new();
    if let Some(path) = &config.standard_csv {
        let rows = read_csv_all(path)?;
        data_groups.insert("standard", rows);
    }
    if let Some(path) = &config.prev_year_csv {
        let rows = read_csv_all(path)?;
        data_groups.insert("previous_year", rows);
    }

    if data_groups.is_empty() {
        return Err("No CSV files loaded".to_string());
    }

    // 3. Plan Operations
    let mut tasks = Vec::new();

    for (csv_type, rows) in &data_groups {
        for template_path in &templates {
            // Check if template matches csv type logic
            let fname = template_path.file_name().unwrap().to_string_lossy();
            let is_prev_year_template = fname.to_lowercase().contains("previousyear");

            if csv_type == &"standard" && is_prev_year_template {
                continue;
            }
            if csv_type == &"previous_year" && !is_prev_year_template {
                continue;
            }

            // Determine Target Rows based on "PM only" logic
            let is_pm_rm = fname.contains("PM_RM");
            let is_pm_only = fname.contains("_PM_") && !is_pm_rm;

            for row in rows {
                // Filter rows
                // Logic: row["PM only or PM-RM"] check
                if let Some(pm_val) = row.get("PM only or PM-RM") {
                    if pm_val == "Do not generate OP" {
                        continue;
                    }
                    if is_pm_rm && pm_val != "PM-RM" {
                        continue;
                    }
                    if is_pm_only && pm_val != "PM only" {
                        continue;
                    }
                }

                // Filter Language
                // Logic: row["Language"] check if it contains the template match
                // We assume template_path parent folder is the language (e.g. ".../FR/template.pptx")
                let parent = template_path
                    .parent()
                    .unwrap()
                    .file_name()
                    .unwrap()
                    .to_string_lossy();
                let params = LangParams {
                    template_lang_folder: parent.to_string(),
                };

                if let Some(row_langs) = row.get("Language") {
                    if !check_lang_match(row_langs, &params.template_lang_folder) {
                        continue;
                    }
                } else {
                    // if no Language column, maybe assume yes? or skip?
                    // Legacy code: if 'Language' in df.columns... else pass.
                    // If column exists but empty -> cleaned to "".
                    // If column absent, we proceed.
                    // We need to know if column exists. In our Map, we can't distinguish "absent" from "empty" if we used clean_values on everything?
                    // Actually read_csv_all preserves headers.
                    // For now, if "Language" key is present and not empty, check it.
                }

                tasks.push((template_path.clone(), row.clone()));
            }
        }
    }

    let total_tasks = tasks.len();
    if total_tasks == 0 {
        return Err("No tasks generated (check Filters)".to_string());
    }

    // Create Timestamped Root Output Directory
    let now = std::time::SystemTime::now();
    let dt: chrono::DateTime<chrono::Local> = now.into();
    let timestamp_folder = format!("OnePagerGeneratedAt_{}", dt.format("%Y-%m-%d_%H-%M-%S"));
    let root_output_path = Path::new(&config.output_dir).join(timestamp_folder);
    fs::create_dir_all(&root_output_path)
        .map_err(|e| format!("Failed to create output dir: {}", e))?;

    // 4. Execute Tasks (Parallel)
    // We use a counter for progress
    let counter = std::sync::atomic::AtomicUsize::new(0);

    let results: Vec<Result<(), String>> = tasks
        .par_iter()
        .map(|(tmpl, row)| {
            let res = process_single_pptx(
                tmpl,
                row,
                root_output_path.to_str().unwrap(),
                &config.mappings,
            );
            let c = counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;

            // Update progress every 5 items or last one
            if c % 5 == 0 || c == total_tasks {
                update_progress(
                    (c as f64 / total_tasks as f64) * 100.0,
                    format!("Processed {}/{}", c, total_tasks),
                );
            }
            res
        })
        .collect();

    let success_count = results.iter().filter(|r| r.is_ok()).count() as u32;
    let error_count = results.iter().filter(|r| r.is_err()).count() as u32;
    let total_time_secs = start_time.elapsed().as_secs_f64();

    Ok(GenStats {
        total_files: total_tasks as u32,
        total_time_secs,
        success_count,
        error_count,
    })
}

struct LangParams {
    template_lang_folder: String,
}

fn check_lang_match(row_val: &str, folder_lang: &str) -> bool {
    let mapped = match folder_lang {
        "FR" => "French",
        "EN" => "English",
        "DE" => "German",
        "IT" => "Italian",
        "ES" => "Spanish",
        _ => folder_lang,
    };
    row_val.contains(mapped) || row_val.contains(folder_lang)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_lang_match_basic() {
        assert!(check_lang_match("French", "FR"));
    }
}

fn scan_templates(dir: &str, languages: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let root = Path::new(dir);

    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|e| e == "pptx").unwrap_or(false) {
            if path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("~$")
            {
                continue;
            }

            // 1. Language Folder
            if let Some(parent) = path.parent() {
                let parent_name = parent.file_name().unwrap_or_default().to_string_lossy();
                if languages
                    .iter()
                    .any(|l| l.eq_ignore_ascii_case(&parent_name))
                {
                    files.push(path.to_path_buf());
                    continue;
                }
            }

            // 2. Root Folder
            if let Ok(stripped) = path.strip_prefix(root) {
                if stripped.components().count() == 1 {
                    files.push(path.to_path_buf());
                }
            }
        }
    }
    Ok(files)
}

pub fn get_available_languages(dir: &str) -> Vec<String> {
    let mut found = Vec::new();
    let known = vec!["FR", "EN", "DE", "IT", "ES"];

    // Check for explicit subfolders
    for lang in &known {
        let path = Path::new(dir).join(lang);
        if path.exists() && path.is_dir() {
            // Check if it contains at least one pptx
            if let Ok(entries) = fs::read_dir(&path) {
                if entries
                    .filter_map(|e| e.ok())
                    .any(|e| e.path().extension().map(|x| x == "pptx").unwrap_or(false))
                {
                    found.push(lang.to_string());
                }
            }
        }
    }

    // Check for root templates (Universal)
    // If root has pptx, it implies support for ALL (or fallback)
    // But for "syncing buttons", maybe we just return what we found.
    // If we find root files, we might signal "Generic" or explicitly add all?
    // Let's just return the list. Frontend will decide to check detected ones.

    found
}

fn process_single_pptx(
    template_path: &Path,
    row: &HashMap<String, String>,
    output_dir: &str,
    mappings: &HashMap<String, String>,
) -> Result<(), String> {
    // Prepare Output Path
    let client = row
        .get("Nom du client")
        .map(|s| s.as_str())
        .unwrap_or("Unknown");
    let org_id = row.get("Org ID").map(|s| s.as_str()).unwrap_or("000");
    let date_str = row
        .get("JJ/MM/AAAA")
        .map(|s| s.replace("/", "-"))
        .unwrap_or_else(|| "00-00-0000".to_string());

    let re = Regex::new(r#"[\\/*?:"<>|]"#).unwrap();
    let client_clean = re.replace_all(client, "").to_string();

    let folder_name = format!("{}_{}", client_clean, org_id);
    let target_folder = Path::new(output_dir).join(folder_name);
    fs::create_dir_all(&target_folder).ok();

    let template_name_lower = template_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let suffix = if template_name_lower.contains("previousyear") {
        "previous_year"
    } else {
        "previous_quarter"
    };

    let fname = format!("{}_{}_{}_{}.pptx", date_str, org_id, client_clean, suffix);
    let output_path = target_folder.join(fname);

    let file = File::open(template_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let out_file = File::create(output_path).map_err(|e| e.to_string())?;
    let mut zip_out = zip::ZipWriter::new(out_file);

    for i in 0..zip.len() {
        let mut file = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(file.compression())
            .unix_permissions(file.unix_mode().unwrap_or(0o644));

        let mut content = Vec::new();
        file.read_to_end(&mut content).map_err(|e| e.to_string())?;

        if name.ends_with(".xml") {
            let mut text = String::from_utf8_lossy(&content).to_string();
            let mut changed = false;

            // Helper for XML escaping
            let escape_xml = |s: &str| -> String {
                s.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&apos;")
            };

            // 1. Implicit Replacements
            for (k, v) in row {
                let val_escaped = escape_xml(v);

                // Variant A: Literal <<Key>> (Rare in PPTX xml but possible)
                let tag = format!("<<{}>>", k);
                // Variant B: Escaped &lt;&lt;Key&gt;&gt; (Standard PPTX)
                let tag_escaped = format!("&lt;&lt;{}&gt;&gt;", escape_xml(k));

                // Try original case
                if text.contains(&tag) {
                    text = text.replace(&tag, &val_escaped);
                    changed = true;
                }
                if text.contains(&tag_escaped) {
                    text = text.replace(&tag_escaped, &val_escaped);
                    changed = true;
                }

                // Try uppercase
                let k_upper = k.to_uppercase();
                let tag_upper = format!("<<{}>>", k_upper);
                let tag_escaped_upper = format!("&lt;&lt;{}&gt;&gt;", escape_xml(&k_upper));

                if text.contains(&tag_upper) {
                    text = text.replace(&tag_upper, &val_escaped);
                    changed = true;
                }
                if text.contains(&tag_escaped_upper) {
                    text = text.replace(&tag_escaped_upper, &val_escaped);
                    changed = true;
                }
            }

            // 2. Explicit Mappings
            for (csv_key, tag_raw) in mappings {
                if let Some(val) = row.get(csv_key) {
                    let val_escaped = escape_xml(val);

                    // tag_raw is e.g. "<<NOM DU CLIENT>>"
                    // We need to support it if it appears literally OR escaped in XML

                    // 1. Literal
                    if text.contains(tag_raw) {
                        text = text.replace(tag_raw, &val_escaped);
                        changed = true;
                    }

                    // 2. Escaped
                    let tag_escaped_ptn = escape_xml(tag_raw); // <<..>> -> &lt;&lt;..&gt;&gt;
                    if text.contains(&tag_escaped_ptn) {
                        text = text.replace(&tag_escaped_ptn, &val_escaped);
                        changed = true;
                    }
                }
            }

            if changed {
                zip_out
                    .start_file(name, options)
                    .map_err(|e| e.to_string())?;
                zip_out
                    .write_all(text.as_bytes())
                    .map_err(|e| e.to_string())?;
                continue;
            }
        }

        zip_out
            .start_file(name, options)
            .map_err(|e| e.to_string())?;
        zip_out.write_all(&content).map_err(|e| e.to_string())?;
    }

    zip_out.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[test]
fn test_generation_e2e() {
    use std::fs;
    use std::io::Write;
    use std::path::Path;

    // 1. Setup Temp Dirs
    let temp_dir = std::env::temp_dir().join("one_pager_test_e2e");
    let template_dir = temp_dir.join("templates");
    let output_dir = temp_dir.join("output");

    // Clean start
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).unwrap();
    }
    fs::create_dir_all(&template_dir).unwrap();
    fs::create_dir_all(&output_dir).unwrap();

    // 2. Create Mock PPTX Template
    let template_path = template_dir.join("test_template.pptx");
    let file = fs::File::create(&template_path).unwrap();
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default();
    zip.start_file("ppt/slides/slide1.xml", options).unwrap();
    // XML with both implicit and explicit tags
    // REAL WORLD SCENARIO: PowerPoint escapes < and >
    // So <<Nom du client>> becomes &lt;&lt;Nom du client&gt;&gt;
    let xml_content = r#"
            <p:txBody>
                <a:p><a:t>Hello &lt;&lt;Nom du client&gt;&gt;</a:t></a:p>
                <a:p><a:t>Date: &lt;&lt;[JJ/MM/AAAA]&gt;&gt;</a:t></a:p>
                <a:p><a:t>Score: &lt;&lt;MY_SCORE_TAG&gt;&gt;</a:t></a:p>
            </p:txBody>
        "#;
    zip.write_all(xml_content.as_bytes()).unwrap();
    zip.finish().unwrap();

    // 3. Prepare Data
    let mut row = HashMap::new();
    row.insert("Nom du client".to_string(), "ACME & Sons".to_string()); // Test Value Escaping too!
    row.insert("Org ID".to_string(), "123".to_string());
    row.insert("JJ/MM/AAAA".to_string(), "01/01/2026".to_string());
    row.insert("ScoreVal".to_string(), "100".to_string());

    let mut mappings = HashMap::new();
    mappings.insert("ScoreVal".to_string(), "<<MY_SCORE_TAG>>".to_string());
    mappings.insert("JJ/MM/AAAA".to_string(), "<<[JJ/MM/AAAA]>>".to_string());

    // 4. Run Process
    let result = process_single_pptx(
        &template_path,
        &row,
        output_dir.to_str().unwrap(),
        &mappings,
    );
    assert!(result.is_ok(), "Process failed: {:?}", result.err());

    // ... (Verification logic needs update to check for escaped values)

    // 5. Verify Output
    // Structure: output_dir / Client_OrgID / Date_OrgID_Client.pptx

    // "ACME & Sons" -> "ACME & Sons" (Regex keeps '&')
    let subfolder = output_dir.join("ACME & Sons_123");
    assert!(subfolder.exists(), "Subfolder not created: {:?}", subfolder);

    let output_file = subfolder.join("01-01-2026_123_ACME & Sons_previous_quarter.pptx");
    assert!(
        output_file.exists(),
        "Output PPTX not created: {:?}",
        output_file
    );

    // 6. Verify Content Replacement
    let file = fs::File::open(output_file).unwrap();
    let mut zip = zip::ZipArchive::new(file).unwrap();
    let mut found_slide = false;

    for i in 0..zip.len() {
        let mut file = zip.by_index(i).unwrap();
        if file.name() == "ppt/slides/slide1.xml" {
            found_slide = true;
            let mut content = String::new();
            file.read_to_string(&mut content).unwrap();

            // Check Replacements (Expect XML Escaping!)
            // "ACME & Sons" -> "ACME &amp; Sons"
            assert!(
                content.contains("Hello ACME &amp; Sons"),
                "Client Name not replaced or not escaped"
            );
            assert!(content.contains("Date: 01/01/2026"), "Date not replaced");
            assert!(content.contains("Score: 100"), "Mapped Score not replaced");

            // Ensure tags are gone
            assert!(
                !content.contains("&lt;&lt;Nom du client&gt;&gt;"),
                "Tag still present"
            );
            assert!(
                !content.contains("&lt;&lt;MY_SCORE_TAG&gt;&gt;"),
                "Tag still present"
            );
        }
    }
    assert!(found_slide, "Slide check failed");

    // Cleanup
    fs::remove_dir_all(&temp_dir).unwrap();
}
