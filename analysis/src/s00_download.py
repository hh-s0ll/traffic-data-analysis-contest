"""원자료 내려받기 (로그인 없이 받을 수 있는 공개 파일데이터).

사용: python src/s00_download.py
- 공공데이터포털 파일 2개는 아래 주소로 직접 받는다. 포털이 파일을 갱신하면 atchFileId 가 바뀌므로,
  실패하면 각 데이터 상세 페이지에서 직접 내려받아 같은 이름으로 data/raw 에 넣는다.
- 공공데이터포털이 다운로드 확인 문자(CAPTCHA)를 요구하면 브라우저에서 직접 받는다.
- 심평원 자료는 전용 다운로드 화면이라 직접 받아야 한다 (아래 안내 출력).
분석에 쓴 원자료의 기준시점: SGIS 경계 2025년 2분기·통계 2024년, 버스정류장 2025-10-31, 심평원 2026년 6월.
다운로드일: 2026-09-30.
"""
import os
import urllib.request
import zipfile

from config import RAW, SGIS

FILES = {
    # 국가데이터처 SGIS 행정구역 통계 및 경계 — https://www.data.go.kr/data/15129688/fileData.do
    "sgis_boundary_stats.zip": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003681593&fileDetailSn=1",
    # 국토교통부 전국 버스정류장 위치정보 — https://www.data.go.kr/data/15067528/fileData.do
    "bus_stops_20251031.csv": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003558143&fileDetailSn=1",
}


def download():
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        dst = RAW / name
        if dst.exists():
            print("있음:", dst.name)
            continue
        print("받는 중:", name)
        urllib.request.urlretrieve(url, dst)


def extract_sgis():
    """SGIS zip 에서 행정동·시군구 경계와 통계 CSV, 코드집만 푼다."""
    SGIS.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(RAW / "sgis_boundary_stats.zip")
    for i in z.infolist():
        name = i.filename
        if i.flag_bits & 0x800 == 0:
            try:
                name = name.encode("cp437").decode("cp949")
            except UnicodeError:
                pass
        base = os.path.basename(name)
        keep = base.startswith("bnd_dong_") or (base.startswith("bnd_sigungu_") and base.endswith((".dbf", ".cpg"))) \
            or base.endswith((".csv", ".xlsx"))
        if base and keep:
            (SGIS / base).write_bytes(z.read(i))


def extract_hira():
    zpath = RAW / "hira_2026_06.zip"
    if not zpath.exists():
        print("\n[직접 내려받기 필요] 건강보험심사평가원 전국 병의원 및 약국 현황 2026.6.zip")
        print("  https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925 에서 받아")
        print(f"  {zpath} 로 저장한 뒤 이 스크립트를 다시 실행하세요.")
        return
    z = zipfile.ZipFile(zpath)
    for i in z.infolist():
        name = i.filename
        if i.flag_bits & 0x800 == 0:
            name = name.encode("cp437").decode("cp949")
        if "1.병원정보서비스" in name:
            (RAW / "hira_hospitals_2026_06.xlsx").write_bytes(z.read(i))
        if "03_진료과목정보" in name:
            (RAW / "hira_departments_2026_06.xlsx").write_bytes(z.read(i))


if __name__ == "__main__":
    download()
    extract_sgis()
    extract_hira()
    print("완료. 다음: python src/run_all.py")
