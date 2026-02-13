
filename = "/mnt/d/progress/utils/gemini_downloader/Google Gemini.html"
output_filename = "/mnt/d/progress/utils/gemini_downloader/analysis_output.txt"

try:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    with open(output_filename, 'w', encoding='utf-8') as out:
        out.write(f"File length: {len(content)}\n")

        targets = [
            "이 사진 속 그림에 어울리는 제목을 지어 줘",
            "보내주신 사진 속 그림은 석양을", 
            "class=\"",
            "data-test-id",
            "model-response",
            "user-query"
        ]

        for target in targets:
            index = content.find(target)
            if index != -1:
                start = max(0, index - 200)
                end = min(len(content), index + 500)
                out.write(f"\n--- Context for '{target}' ---\n")
                out.write(content[start:end])
                out.write("\n")
            else:
                out.write(f"\nTarget '{target}' not found.\n")

    print("Analysis complete. Written to " + output_filename)

except Exception as e:
    with open(output_filename, 'w', encoding='utf-8') as out:
         out.write(f"Error: {e}\n")
    print(f"Error: {e}")
