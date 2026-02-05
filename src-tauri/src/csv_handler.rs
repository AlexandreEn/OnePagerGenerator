use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsvRecord {
    pub headers: HashMap<String, String>,
    pub data: HashMap<String, String>,
}

pub fn clean_value(val: &str) -> String {
    let v = val.trim();
    // Check for N/A variants
    let lower = v.to_lowercase();
    if v.is_empty()
        || lower == "#n/a"
        || lower == "null"
        || lower == "none"
        || lower == "nan"
        || lower == "n.a"
        || lower == "na"
    {
        return "".to_string();
    }

    // Try to parse as float and check if integer
    if let Ok(f) = v.parse::<f64>() {
        // If it's effectively an integer (e.g. 10.0), return "10"
        if (f.fract()).abs() < f64::EPSILON {
            return (f as i64).to_string();
        }
        // Otherwise return original string (or formatted float if prefer, but original is safer)
        return v.to_string();
    }

    v.to_string()
}

pub fn read_csv_all<P: AsRef<Path>>(path: P) -> Result<Vec<HashMap<String, String>>, String> {
    let path_ref = path.as_ref();
    let file = File::open(path_ref).map_err(|e| e.to_string())?;
    
    // Auto-detect delimiter
    // Read first line to guess
    let mut delim = b',';
    {
        use std::io::{BufRead, BufReader};
        let mut reader = BufReader::new(File::open(path_ref).map_err(|e| e.to_string())?);
        let mut first_line = String::new();
        if reader.read_line(&mut first_line).is_ok() {
            if first_line.contains(';') {
                delim = b';';
            }
        }
    }

    let mut rdr = ReaderBuilder::new()
        .delimiter(delim)
        .has_headers(true)
        .from_reader(file);

    let headers = rdr.headers().map_err(|e| e.to_string())?.clone();
    let mut records = Vec::new();

    for result in rdr.records() {
        let record = result.map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        
        for (i, field) in record.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                map.insert(header.to_string(), clean_value(field));
            }
        }
        records.push(map);
    }

    Ok(records)
}

pub fn read_csv_preview<P: AsRef<Path>>(path: P, limit: usize) -> Result<Vec<HashMap<String, String>>, String> {
    let path_ref = path.as_ref();
    let file = File::open(path_ref).map_err(|e| e.to_string())?;

    // Auto-detect delimiter
    let mut delim = b',';
    {
        use std::io::{BufRead, BufReader};
        let mut reader = BufReader::new(File::open(path_ref).map_err(|e| e.to_string())?);
        let mut first_line = String::new();
        if reader.read_line(&mut first_line).is_ok() {
            if first_line.contains(';') {
                delim = b';';
            }
        }
    }

    let mut rdr = ReaderBuilder::new()
        .delimiter(delim)
        .has_headers(true)
        .from_reader(file);

    let headers = rdr.headers().map_err(|e| e.to_string())?.clone();
    let mut records = Vec::new();

    for (count, result) in rdr.records().enumerate() {
        if count >= limit {
            break;
        }
        let record = result.map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        
        for (i, field) in record.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                map.insert(header.to_string(), clean_value(field));
            }
        }
        records.push(map);
    }

    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_value_integers() {
        assert_eq!(clean_value("10"), "10");
        assert_eq!(clean_value("10.0"), "10");
        assert_eq!(clean_value("42.000000"), "42");
    }

    #[test]
    fn test_clean_value_floats() {
        assert_eq!(clean_value("10.5"), "10.5");
        assert_eq!(clean_value("0.001"), "0.001");
    }

    #[test]
    fn test_clean_value_strings() {
        assert_eq!(clean_value("Hello"), "Hello");
        assert_eq!(clean_value("123 Street"), "123 Street");
    }

    #[test]
    fn test_clean_value_nans() {
        assert_eq!(clean_value(""), "");
        assert_eq!(clean_value("nan"), "");
        assert_eq!(clean_value("NaN"), "");
        assert_eq!(clean_value("NAN"), "");
        assert_eq!(clean_value("#N/A"), "");
        assert_eq!(clean_value("NULL"), "");
        assert_eq!(clean_value("None"), "");
    }

    #[test]
    fn test_clean_value_edge_cases() {
        assert_eq!(clean_value("  10.0  "), "10");
        assert_eq!(clean_value("  nan  "), "");
    }
}
