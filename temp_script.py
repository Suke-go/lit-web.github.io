import codecs

file_path = "C:\\Users\\kosuk\\litable-web\\index.html"

try:
    # ファイルを Shift-JIS として読み込む
    with codecs.open(file_path, 'r', 'shift_jis') as f:
        content = f.read()
except Exception as e:
    # UTF-8での読み込みも試す
    try:
        with codecs.open(file_path, 'r', 'utf-8') as f:
            content = f.read()
    except Exception as e_utf8:
        print(f"Error reading file: {e_utf8}")
        exit()

# 文字列を置換
content = content.replace("                  <p>「大学進学」など短期的な課題の解決だけではなく、<br class=\" -pcItem\">大学卒業後までの見通しを言葉にしていき、<br class=\" -pcItem\">主体的に行動を起こすことを促します。</p>", "                  <p>過去〜未来を繋ぎ、今学ぶ意味を納得化</p>")
content = content.replace("                  <p>生徒の頭にある「なんとなく」な理想を実現可能に磨いていきます。<br>\n                    生徒の気持ちに深く共感をし、心理的にサポートすることで、<br class=\" -pcItem\">一人では見つけられなかったジブン発見を支援します。</p>", "                  <p>思考の分解で、モヤモヤを具体化</p>")
content = content.replace("                  <p>自分のことで分からなくなったり、<br class=\" -pcItem\">
                    どうすればいいかわからないという生徒さんの気持ちに<br class=\" -pcItem\">徹底的に向き合います。</p>", "                  <p>答えを教えず、考える力を引き出す</p>")

# ファイルを UTF-8 として書き込む
try:
    with codecs.open(file_path, 'w', 'utf-8') as f:
        f.write(content)
except Exception as e:
    print(f"Error writing file: {e}")
