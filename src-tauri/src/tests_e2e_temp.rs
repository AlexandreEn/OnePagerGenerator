
    #[test]
    fn test_generation_e2e() {
        use std::io::Write;
        use std::fs;
        use std::path::Path;

        // 1. Setup Temp Dirs
        let temp_dir = std::env::temp_dir().join("one_pager_test_e2e");
        let template_dir = temp_dir.join("templates");
        let output_dir = temp_dir.join("output");
        
        // Clean start
        if temp_dir.exists() { fs::remove_dir_all(&temp_dir).unwrap(); }
        fs::create_dir_all(&template_dir).unwrap();
        fs::create_dir_all(&output_dir).unwrap();

        // 2. Create Mock PPTX Template
        let template_path = template_dir.join("test_template.pptx");
        let file = fs::File::create(&template_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        
        let options = zip::write::SimpleFileOptions::default();
        zip.start_file("ppt/slides/slide1.xml", options).unwrap();
        // XML with both implicit and explicit tags
        let xml_content = r#"
            <p:txBody>
                <a:p><a:t>Hello <<Nom du client>></a:t></a:p>
                <a:p><a:t>Date: <<[JJ/MM/AAAA]>></a:t></a:p>
                <a:p><a:t>Score: <<MY_SCORE_TAG>></a:t></a:p>
            </p:txBody>
        "#;
        zip.write_all(xml_content.as_bytes()).unwrap();
        zip.finish().unwrap();

        // 3. Prepare Data
        let mut row = HashMap::new();
        row.insert("Nom du client".to_string(), "ACME Corp".to_string());
        row.insert("Org ID".to_string(), "123".to_string());
        row.insert("JJ/MM/AAAA".to_string(), "01/01/2026".to_string());
        row.insert("ScoreVal".to_string(), "100".to_string()); // For mapping

        let mut mappings = HashMap::new();
        mappings.insert("ScoreVal".to_string(), "<<MY_SCORE_TAG>>".to_string());
        mappings.insert("JJ/MM/AAAA".to_string(), "<<[JJ/MM/AAAA]>>".to_string()); // Explicit rule

        // 4. Run Process
        // Note: process_single_pptx expects output_dir to be the ROOT output, it creates subfolders.
        let result = process_single_pptx(&template_path, &row, output_dir.to_str().unwrap(), &mappings);
        assert!(result.is_ok(), "Process failed: {:?}", result.err());

        // 5. Verify Output
        // Structure: output_dir / Client_OrgID / Date_OrgID_Client.pptx
        let client_clean = "ACME Corp".replace(" ", ""); // Regex removes spaces? Check regex in code.
        // Code regex removes [\\/*?:"<>|], spaces are KEPT in code regex r#"[\\/*?:"<>|]"#
        // Wait, check code regex again.
        // let re = Regex::new(r#"[\\/*?:"<>|]"#).unwrap(); 
        // So "ACME Corp" -> "ACME Corp"
        
        let subfolder = output_dir.join("ACME Corp_123");
        assert!(subfolder.exists(), "Subfolder not created: {:?}", subfolder);

        let output_file = subfolder.join("01-01-2026_123_ACME Corp.pptx");
        assert!(output_file.exists(), "Output PPTX not created: {:?}", output_file);

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

                // Check Replacements
                assert!(content.contains("Hello ACME Corp"), "Client Name not replaced");
                assert!(content.contains("Date: 01/01/2026"), "Date not replaced");
                assert!(content.contains("Score: 100"), "Mapped Score not replaced");
                
                // Ensure tags are gone
                assert!(!content.contains("<<Nom du client>>"), "Tag still present");
                assert!(!content.contains("<<MY_SCORE_TAG>>"), "Tag still present");
            }
        }
        assert!(found_slide, "Slide check failed");
        
        // Cleanup
        fs::remove_dir_all(&temp_dir).unwrap();
    }
