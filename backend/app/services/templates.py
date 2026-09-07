"""立契模板。

UC-03 的成本必须足够低：陌生人不会自己去写一份合作协议，
所以 ISH 在项目创建时就把「最容易日后翻脸的问题」预置成条款，
团队只需要改和确认，而不是从空白开始。
"""

MODE_LABELS = {
    "interest": "兴趣共创 · 暂无金钱交换",
    "interest_then_revenue": "兴趣共创 · 商业化后重新确认收益",
    "commercial": "商业项目 · 有预算",
    "open_source": "非商业 / 开源",
}

STAGE_LABELS = {
    "concept": "Concept 概念",
    "prototype": "Prototype 原型",
    "vertical_slice": "Vertical Slice 纵切片",
    "demo": "Demo 试玩版",
    "beta": "Beta 测试",
    "release": "Release 发行",
    "archived": "Archived 归档",
}


def default_clauses(project_title: str, mode: str) -> list[dict]:
    mode_label = MODE_LABELS.get(mode, mode)
    return [
        {
            "key": "scope",
            "title": "我们在做什么",
            "body": f"本契约适用于项目《{project_title}》及其直接衍生成果。",
        },
        {
            "key": "nature",
            "title": "当前合作性质",
            "body": (
                f"当前合作性质为：{mode_label}。"
                "如果性质发生变化（例如从兴趣共创转为商业项目），必须发布新版本契约并由全体成员重新确认。"
            ),
        },
        {
            "key": "prior_ip",
            "title": "加入前已有的成果与 IP",
            "body": "成员加入前已经拥有的作品、素材与 IP 仍归原权利人所有，不因参与本项目而转移。",
        },
        {
            "key": "new_ip",
            "title": "项目过程中产生的新成果",
            "body": "项目期间共同产生的成果由参与创作的成员共同享有；对外授权、发行或转让需要全体在册成员同意。",
        },
        {
            "key": "revenue",
            "title": "未来收益",
            "body": (
                "在产生任何实际收益之前不预设分配比例。"
                "一旦出现收益可能，必须先发布新版本契约写明分配方式，并经全体成员重新确认后才生效。"
            ),
        },
        {
            "key": "exit",
            "title": "成员退出",
            "body": (
                "任何成员可以随时退出。退出时已完成并交付的成果保留在项目中，"
                "该成员的署名与已完成的里程碑记录不被删除。"
            ),
        },
        {
            "key": "termination",
            "title": "项目终止",
            "body": "项目终止后，成员可以在署名注明原项目的前提下，继续在个人作品集中展示自己的部分。",
        },
        {
            "key": "credit",
            "title": "署名",
            "body": "所有对外发布的成果必须列出全体在册成员及其角色，署名不可被单方面删除。",
        },
    ]
